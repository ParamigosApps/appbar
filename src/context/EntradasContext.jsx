// --------------------------------------------------------------
// src/context/EntradasContext.jsx — VERSIÓN FINAL ULTRA PRO 2025
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

import {
  abrirSeleccionLote,
  abrirMetodoPago,
} from '../services/entradasSwal.js'

import Swal from 'sweetalert2'

// --------------------------------------------------------------
// CONTEXTO
// --------------------------------------------------------------
const EntradasContext = createContext()
export const useEntradas = () => useContext(EntradasContext)

// --------------------------------------------------------------
// VERIFICACIÓN FREE — **CORREGIDA**
// --------------------------------------------------------------
async function verificarPermisosEntradaFree({
  eventoId,
  usuarioId,
  lote = null,
}) {
  console.log('🟦 verificarPermisosEntradaFree()', {
    eventoId,
    usuarioId,
    lote,
  })

  const snap1 = await getDocs(
    query(
      collection(db, 'entradas'),
      where('usuarioId', '==', usuarioId),
      where('eventoId', '==', eventoId),
      where('precio', '==', 0)
    )
  )
  const obtenidas = snap1.docs.map(d => d.data())

  const snap2 = await getDocs(
    query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', usuarioId),
      where('eventoId', '==', eventoId),
      where('precio', '==', 0)
    )
  )
  const pendientes = snap2.docs.map(d => d.data())

  const totalObtenidas = obtenidas.reduce((a, e) => a + (e.cantidad || 1), 0)
  const totalPendientes = pendientes.reduce((a, e) => a + (e.cantidad || 1), 0)
  const totalUsuario = totalObtenidas + totalPendientes

  console.log('📊 FREE usuario:', {
    totalObtenidas,
    totalPendientes,
    totalUsuario,
  })

  // ----------------------------------------------------------
  // 🟣 CASO FREE POR LOTE — NO SE USA maxFreeUser
  // ----------------------------------------------------------
  if (lote) {
    console.log('🟪 FREE por lote detectado → usar lote.restantes')

    if (lote.restantes <= 0) {
      return {
        puede: false,
        motivo: 'Lote lleno',
        maxPermitidas: 0,
        totalObtenidas,
        totalPendientes,
      }
    }

    // permitir pedir mientras queden cupos en el lote
    return {
      puede: true,
      maxPermitidas: lote.restantes,
      totalObtenidas,
      totalPendientes,
    }
  }

  // ----------------------------------------------------------
  // 🟩 EVENTO SIN LOTES — FREE GLOBAL
  // ----------------------------------------------------------
  const snapEv = await getDocs(
    query(collection(db, 'eventos'), where('__name__', '==', eventoId))
  )
  const eventoData = snapEv.docs[0]?.data() || {}

  const maxFree =
    Number(eventoData.maxFreeUser) || Number(eventoData.maxEntradasFree) || 1

  if (totalUsuario >= maxFree) {
    return {
      puede: false,
      motivo: 'Límite FREE global',
      maxPermitidas: maxFree,
      totalObtenidas,
      totalPendientes,
    }
  }

  return {
    puede: true,
    maxPermitidas: maxFree,
    totalObtenidas,
    totalPendientes,
  }
}

// --------------------------------------------------------------
// PROVIDER ROOT
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

  // --------------------------------------------------------------
  // EVENTOS
  // --------------------------------------------------------------
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

  // --------------------------------------------------------------
  // MIS ENTRADAS
  // --------------------------------------------------------------
  useEffect(() => {
    if (!user) return setMisEntradas([])
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
    } catch {}
  }

  // --------------------------------------------------------------
  // PENDIENTES REALTIME
  // --------------------------------------------------------------
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
        await Swal.fire({
          title: 'Iniciá sesión',
          text: 'Necesitás estar logueado para continuar',
          icon: 'warning',
        })

        // 🔥 CORRECCIÓN PARA EVITAR LOOP INFINITO
        setTimeout(() => {
          abrirLoginGlobal()
        }, 0)

        return
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'

      const { eventoData, maxUser, lotesInfo } = await calcularCuposEvento(
        evento.id,
        usuarioId
      )

      if (maxUser <= 0) {
        await Swal.fire({
          title: 'Límite alcanzado',
          text: 'Ya alcanzaste el máximo de entradas.',
          icon: 'info',
        })
        return
      }

      const precioEvento = Number(eventoData.precio || 0)

      // ----------------------------------------------------------
      // EVENTO CON LOTES
      // ----------------------------------------------------------
      if (lotesInfo.length > 0) {
        const idLote = await abrirSeleccionLote(evento, lotesInfo)
        if (idLote === undefined || idLote === null) return

        let loteSel =
          lotesInfo.find(l => String(l.id) === String(idLote)) ||
          lotesInfo.find(l => String(l.index) === String(idLote)) ||
          lotesInfo[idLote] ||
          null

        if (!loteSel) {
          await Swal.fire('Error', 'No se pudo identificar el lote.', 'error')
          return
        }

        const precioLote = Number(loteSel.precio || 0)

        if (precioLote <= 0) {
          const verif = await verificarPermisosEntradaFree({
            eventoId: evento.id,
            usuarioId,
            lote: loteSel,
          })

          if (!verif.puede) {
            return Swal.fire({
              title: 'Límite alcanzado',
              html: `
              <p>Obtenidas: <b>${verif.totalObtenidas}</b></p>
              <p>Pendientes: <b>${verif.totalPendientes}</b></p>
              <p>Máximo FREE: <b>${verif.maxPermitidas}</b></p>
            `,
              icon: 'info',
            })
          }

          return pedirEntradaFreeConLote({
            evento,
            loteSel,
            usuarioId,
            usuarioNombre,
            mostrarQrReact,
            cargarEntradasUsuario,
          })
        }

        const maxCantidadPago = Math.min(maxUser, loteSel.restantes)
        if (maxCantidadPago <= 0) {
          await Swal.fire('Sin cupos', 'No quedan cupos en este lote.', 'info')
          return
        }

        const resultPago = await abrirMetodoPago(
          evento,
          loteSel,
          precioLote,
          maxCantidadPago
        )

        if (resultPago?.cancelado) {
          return Swal.fire(
            'Compra cancelada',
            'Compra cancelada por el usuario.',
            'info'
          )
        }

        if (!resultPago) return

        if (resultPago.metodo === 'transfer') {
          return manejarTransferencia({
            evento,
            precio: precioLote,
            cantidadSel: resultPago.cantidad,
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
          cantidadSel: resultPago.cantidad,
          usuarioId,
          eventoId: evento.id,
        })
      }

      // ----------------------------------------------------------
      // EVENTO SIN LOTES — FREE
      // ----------------------------------------------------------
      if (precioEvento <= 0) {
        const verif = await verificarPermisosEntradaFree({
          eventoId: evento.id,
          usuarioId,
        })

        if (!verif.puede) {
          return Swal.fire({
            title: 'No podés pedir más',
            html: `
            <p>Obtenidas: <b>${verif.totalObtenidas}</b></p>
            <p>Pendientes: <b>${verif.totalPendientes}</b></p>
          `,
            icon: 'info',
          })
        }

        return pedirEntradaFreeSinLote({
          evento,
          usuarioId,
          usuarioNombre,
          maxUser,
          mostrarQrReact,
          cargarEntradasUsuario,
        })
      }

      // ----------------------------------------------------------
      // EVENTO SIN LOTES — PAGO
      // ----------------------------------------------------------
      const resultPago = await abrirMetodoPago(
        evento,
        null,
        precioEvento,
        maxUser
      )

      if (resultPago?.cancelado) {
        return Swal.fire(
          'Compra cancelada',
          'Compra cancelada por el usuario.',
          'info'
        )
      }

      if (!resultPago) return

      if (resultPago.metodo === 'transfer') {
        return manejarTransferencia({
          evento,
          precio: precioEvento,
          cantidadSel: resultPago.cantidad,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,
          crearSolicitudPendiente,
        })
      }

      return manejarMercadoPago({
        evento,
        precio: precioEvento,
        cantidadSel: resultPago.cantidad,
        usuarioId,
        eventoId: evento.id,
      })
    } catch (err) {
      console.error('❌ ERROR pedirEntrada:', err)
      Swal.fire('Error', 'Ocurrió un problema inesperado.', 'error')
    }
  }

  // --------------------------------------------------------------
  // PROVIDER FINAL
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
