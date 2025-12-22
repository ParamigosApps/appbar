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

import { useAuth } from './AuthContext.jsx'
import { useQr } from './QrContext.jsx'
import { abrirLoginGlobal } from '../utils/utils'
import Swal from 'sweetalert2'
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

import {
  crearSolicitudPendiente,
  obtenerTotalPendientes,
} from '../logic/entradas/entradasUtils.js'

// SWALS
import {
  abrirSeleccionLote,
  abrirResumenLote,
  abrirSeleccionLotesMultiPro,
} from '../services/entradasSwal.js'

// --------------------------------------------------------------
// CONTEXTO
// --------------------------------------------------------------
const EntradasContext = createContext()
export const useEntradas = () => useContext(EntradasContext)

// --------------------------------------------------------------
// PROVIDER
// --------------------------------------------------------------
export function EntradasProvider({ children }) {
  const { mostrarQrReact } = useQr()

  const [eventos, setEventos] = useState([])
  const [misEntradas, setMisEntradas] = useState([])
  const [entradasPendientes, setEntradasPendientes] = useState([])
  const [entradasUsadas, setEntradasUsadas] = useState([])

  const [historialEntradas, setHistorialEntradas] = useState([])
  const [loadingEventos, setLoadingEventos] = useState(true)
  const { user, loading } = useAuth()

  // ----------------------------------------------------------
  // CARGAR HISTORIAL DE ENTRADAS USADAS
  // ----------------------------------------------------------
  async function cargarHistorial(uid) {
    try {
      const q = query(
        collection(db, 'entradas'),
        where('usuarioId', '==', uid),
        where('usado', '==', true)
      )

      const snap = await getDocs(q)

      setHistorialEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error('❌ Error cargando historial:', e)
      setHistorialEntradas([])
    }
  }

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
  // CARGAR HISTORIAL ENTRADAS USUARIO
  // ----------------------------------------------------------

  useEffect(() => {
    if (!user?.uid) {
      setHistorialEntradas([])
      return
    }

    cargarHistorial(user.uid)
  }, [user])

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
        const res = await Swal.fire({
          title: 'Iniciá sesión',
          text: 'Necesitás estar logueado.',
          icon: 'warning',
          confirmButtonText: 'Iniciar sesión',

          buttonsStyling: false,
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        })

        if (res.isConfirmed) {
          abrirLoginGlobal()
        }

        return // ⛔ CORTE DURO SIEMPRE
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'
      const usuarioEmail = user.email || null

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
      // EVENTO CON LOTES — MULTI LOTE
      // --------------------------------------------------------------
      if (lotesInfo.length > 0) {
        const seleccion = await abrirSeleccionLotesMultiPro(evento, lotesInfo)
        if (!seleccion) return

        const total = seleccion.reduce(
          (acc, s) =>
            acc + Number(s.lote.precio || 0) * Number(s.cantidad || 0),
          0
        )

        const totalFinal = Number(total)

        if (!Number.isFinite(totalFinal) || totalFinal <= 0) {
          console.error('❌ Total inválido MP:', totalFinal, seleccion)

          await Swal.fire({
            title: 'Error',
            text: 'El monto del pago es inválido.',
            icon: 'error',
          })

          return
        }
        // ==========================
        // TODOS GRATIS
        // ==========================
        if (total === 0) {
          for (const s of seleccion) {
            await pedirEntradaFreeConLote({
              evento,
              loteSel: s.lote,
              usuarioId,
              usuarioNombre,
              usuarioEmail,
              cantidadSel: s.cantidad, // ✅ CORRECTO
              mostrarQrReact,
              cargarEntradasUsuario,
            })
          }

          return
        }
        const descripcionPago = seleccion
          .map(
            s =>
              `• ${s.cantidad} × ${s.lote.nombre} ($${Number(
                s.lote.precio || 0
              )})`
          )
          .join('<br>')
        // ==========================
        // HAY PAGO
        // ==========================
        const r = await Swal.fire({
          title: '¿Cómo querés pagar?',
          html: `
    <div style="text-align:left">
      <p><b>Entradas:</b></p>
      <p style="font-size:14px; opacity:.85">
        ${descripcionPago}
      </p>
      <hr />
      <p style="font-size:18px">
        <b>Total:</b> $${total}
      </p>
    </div>
  `,
          showCancelButton: true,
          confirmButtonText: 'Mercado Pago',
          cancelButtonText: 'Transferencia',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'swal-btn-confirm',
            cancelButton: 'swal-btn-cancel',
          },
        })

        if (r.isConfirmed) {
          return manejarMercadoPago({
            evento,
            loteSel: {
              id: 'multi',
              nombre: descripcionPago,
            },
            precioUnitario: totalFinal, // total final
            cantidadSel: 1, // ✅ CLAVE
            usuarioId,
            eventoId: evento.id,
          })
        }

        return manejarTransferencia({
          evento,
          precio: total,

          loteSel: {
            nombre: descripcionPago,
            detalle: seleccion.map(s => ({
              loteId: s.lote.id ?? s.lote.index,
              nombre: s.lote.nombre,
              cantidad: s.cantidad,
              precioUnitario: Number(s.lote.precio || 0),
              subtotal: Number(s.lote.precio || 0) * s.cantidad,
            })),
          },
          usuarioId,
          usuarioNombre,
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
          usuarioEmail,
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
        historialEntradas,

        pedirEntrada,
        cargarEntradasUsuario,
        recargarPendientes,
        cargarEntradasUsadas,
        cargarHistorial,
      }}
    >
      {children}
    </EntradasContext.Provider>
  )
}
