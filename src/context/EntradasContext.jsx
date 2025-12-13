// --------------------------------------------------------------
// src/context/EntradasContext.jsx — VERSIÓN FINAL ESTABLE 2025
// --------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore'

import { db } from '../Firebase.js'
import { useFirebase } from './FirebaseContext.jsx'
import { useAuth } from './AuthContext.jsx'
import { useQr } from './QrContext.jsx'

// LÓGICA
import { calcularCuposEvento } from '../logic/entradas/entradasEventos.js'
import {
  pedirEntradaFreeSinLote,
  pedirEntradaFreeConLote,
} from '../logic/entradas/entradasGratis.js'
import {
  manejarTransferencia,
  manejarMercadoPago,
} from '../logic/entradas/entradasPago.js'

import { crearSolicitudPendiente } from '../logic/entradas/entradasUtils.js'

// SWALS
import {
  abrirSeleccionLote,
  abrirResumenLote,
} from '../services/entradasSwal.js'

import Swal from 'sweetalert2'

// --------------------------------------------------------------
// CONTEXTO
// --------------------------------------------------------------
const EntradasContext = createContext()
export const useEntradas = () => useContext(EntradasContext)

// --------------------------------------------------------------
// PROVIDER
// --------------------------------------------------------------
export function EntradasProvider({ children }) {
  const { user } = useFirebase()
  const { abrirLoginGlobal } = useAuth()
  const { mostrarQrReact } = useQr()

  const [eventos, setEventos] = useState([])
  const [misEntradas, setMisEntradas] = useState([])
  const [entradasPendientes, setEntradasPendientes] = useState([])
  const [entradasUsadas, setEntradasUsadas] = useState([])
  const [loadingEventos, setLoadingEventos] = useState(true)

  // ----------------------------------------------------------
  // CARGAR EVENTOS
  // ----------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDocs(collection(db, 'eventos'))
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        arr.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        setEventos(arr)
      } catch (e) {
        console.error('❌ Error cargando eventos:', e)
      }
      setLoadingEventos(false)
    }
    cargar()
  }, [])

  // ----------------------------------------------------------
  // CARGAR ENTRADAS USUARIO
  // ----------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setMisEntradas([])
      setEntradasUsadas([])
      return
    }
    cargarEntradasUsuario(user.uid)
    cargarEntradasUsadas(user.uid)
  }, [user])

  async function cargarEntradasUsuario(uid) {
    const snap = await getDocs(
      query(collection(db, 'entradas'), where('usuarioId', '==', uid))
    )
    setMisEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function cargarEntradasUsadas(uid) {
    try {
      const snap = await getDocs(
        query(collection(db, 'entradasUsadas'), where('usuarioId', '==', uid))
      )
      setEntradasUsadas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.log('⚠ No existe entradasUsadas aún.')
    }
  }

  // ----------------------------------------------------------
  // ESCUCHAR ENTRADAS PENDIENTES
  // ----------------------------------------------------------
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )
    return onSnapshot(q, snap => {
      setEntradasPendientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  async function recargarPendientes(uid) {
    const snap = await getDocs(
      query(collection(db, 'entradasPendientes'), where('usuarioId', '==', uid))
    )
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    setEntradasPendientes(data)
    return data
  }

  // --------------------------------------------------------------
  // FUNCIÓN PRINCIPAL: PEDIR ENTRADA
  // --------------------------------------------------------------
  async function pedirEntrada(evento) {
    try {
      if (!user) {
        await Swal.fire('Iniciá sesión', 'Necesitás estar logueado.', 'warning')
        setTimeout(() => abrirLoginGlobal(), 0)
        return
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'

      // --------------------------------------------------------------
      // CALCULAR CUPOS REALES
      // --------------------------------------------------------------
      const { eventoData, limitePorUsuario, totalUsuario, maxUser, lotesInfo } =
        await calcularCuposEvento(evento.id, usuarioId)

      if (maxUser <= 0) {
        await Swal.fire({
          title: 'Límite alcanzado',
          text: 'Ya alcanzaste el máximo de entradas permitidas.',
          icon: 'info',
          confirmButtonText: 'Aceptar',

          customClass: {
            popup: 'swal-popup-custom',
            htmlContainer: 'swal-text-center',
            confirmButton: 'swal-btn-confirm',
          },

          buttonsStyling: false,
        })
        return
      }

      // --------------------------------------------------------------
      // EVENTO CON LOTES
      // --------------------------------------------------------------
      if (lotesInfo.length > 0) {
        const resSel = await abrirSeleccionLote(evento, lotesInfo)
        if (!resSel || resSel.cancelado) return

        const loteSel =
          lotesInfo.find(l => String(l.index) === String(resSel.loteId)) ||
          lotesInfo.find(l => String(l.id) === String(resSel.loteId))

        if (!loteSel) return

        const precioLote = Number(loteSel.precio || 0)
        const restantes = loteSel.restantes

        // --------------------------------------------------------------
        // LOTES FREE
        // --------------------------------------------------------------
        if (precioLote === 0) {
          const maxCantidad = Math.min(maxUser, restantes)

          const resResumen = await abrirResumenLote(evento, loteSel, {
            totalObtenidas: totalUsuario,
            totalPendientes: 0,
            limiteUsuario: limitePorUsuario - totalUsuario,
            maxCantidad,
            cuposLote: restantes,
            precioUnitario: 0,
            esGratis: true,
          })

          if (!resResumen || resResumen.cancelado) return

          const cantidadSel = resResumen.cantidad || 1

          return pedirEntradaFreeConLote({
            evento,
            loteSel,
            usuarioId,
            usuarioNombre,
            cantidadSel,
            mostrarQrReact,
            cargarEntradasUsuario,
          })
        }

        // --------------------------------------------------------------
        // LOTE PAGO
        // --------------------------------------------------------------
        const maxCantidadPago = Math.min(maxUser, restantes)

        const resResumen = await abrirResumenLote(evento, loteSel, {
          totalObtenidas: totalUsuario,
          totalPendientes: 0,
          limiteUsuario: limitePorUsuario - totalUsuario,
          maxCantidad: maxCantidadPago,
          cuposLote: restantes,
          precioUnitario: precioLote,
          esGratis: false,
        })

        if (!resResumen || resResumen.cancelado) return

        const { cantidad, metodo } = resResumen
        const cantidadSel = cantidad || 1

        if (metodo === 'transfer') {
          return manejarTransferencia({
            evento,
            precio: precioLote,
            cantidadSel,
            loteSel,
            usuarioId,
            usuarioNombre,
            eventoId: evento.id,
            crearSolicitudPendiente,
          })
        }

        return manejarMercadoPago({
          evento,
          precio: precioLote,
          cantidadSel,
          usuarioId,
          eventoId: evento.id,
        })
      }

      // --------------------------------------------------------------
      // EVENTO SIN LOTES — FREE
      // --------------------------------------------------------------
      const precioEvento = Number(eventoData.precio || 0)

      if (precioEvento === 0) {
        const maxCantidad = maxUser

        const loteVirtual = {
          nombre: 'Entrada general',
          precio: 0,
        }

        const resResumen = await abrirResumenLote(evento, loteVirtual, {
          totalObtenidas: totalUsuario,
          limiteUsuario: limitePorUsuario - totalUsuario,
          maxCantidad,
          precioUnitario: 0,
          esGratis: true,
        })

        if (!resResumen || resResumen.cancelado) return

        const cantidadSel = resResumen.cantidad || 1

        return pedirEntradaFreeSinLote({
          evento,
          usuarioId,
          usuarioNombre,
          maxUser,
          cantidadSel,
          mostrarQrReact,
          cargarEntradasUsuario,
        })
      }

      // --------------------------------------------------------------
      // EVENTO SIN LOTES — PAGO
      // --------------------------------------------------------------
      const loteVirtualPago = {
        nombre: 'Entrada general',
        precio: precioEvento,
      }

      const resResumen = await abrirResumenLote(evento, loteVirtualPago, {
        totalObtenidas: totalUsuario,
        limiteUsuario: limitePorUsuario - totalUsuario,
        maxCantidad: maxUser,
        precioUnitario: precioEvento,
        esGratis: false,
      })

      if (!resResumen || resResumen.cancelado) return

      const { cantidad, metodo } = resResumen
      const cantidadSel = cantidad || 1

      if (metodo === 'transfer') {
        return manejarTransferencia({
          evento,
          precio: precioEvento,
          cantidadSel,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,
          crearSolicitudPendiente,
        })
      }

      return manejarMercadoPago({
        evento,
        precio: precioEvento,
        cantidadSel,
        usuarioId,
        eventoId: evento.id,
      })
    } catch (err) {
      console.error('❌ ERROR pedirEntrada:', err)
      Swal.fire('Error', 'Ocurrió un error inesperado.', 'error')
    }
  }

  // --------------------------------------------------------------
  // EXPORTAR
  // --------------------------------------------------------------
  return (
    <EntradasContext.Provider
      value={{
        eventos,
        loadingEventos,

        misEntradas,
        entradasPendientes,
        entradasUsadas,

        pedirEntrada,
        cargarEntradasUsuario,
        recargarPendientes,
        cargarEntradasUsadas,
      }}
    >
      {children}
    </EntradasContext.Provider>
  )
}
