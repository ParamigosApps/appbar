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
import { abrirLoginGlobal, normalizarPrecio } from '../utils/utils'
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
  abrirResumenLote,
  abrirSeleccionLotesMultiPro,
} from '../services/entradasSwal.js'

import { showLoading, hideLoading } from '../services/loadingService'
import { formatearSoloFecha } from '../utils/utils'
import { triggerLimpiezaPagos } from '../services/triggerLimpiezaPagos'
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
    triggerLimpiezaPagos()

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

  function renderResumenEntradas({ gratis = [], pagas = [] }) {
    const rowsGratis = gratis.map(g => {
      return `
    <div class="limite-row entrada gratis">
      <span class="label">
        ${g.lote.nombre} x<span class="cantidad">${g.cantidad}</span>
        <span class="badge-generadas">Confirmado</span>
      </span>
      <span class="value gratis-text">GRATIS</span>
    </div>
  `
    })

    const rowsPagas = pagas.map(p => {
      const sub = p.cantidad * p.precio

      return `
    <div class="limite-row entrada paga">
      <span class="label">
        ${p.nombre} x<span class="cantidad">${p.cantidad}</span>
      </span>
      <span class="value">$${sub.toLocaleString('es-AR')}</span>
    </div>
  `
    })

    return `
    <div class="resumen-lote-box">
      
      <hr />
      <div class="info-limites-box">
        ${[...rowsGratis, ...rowsPagas].join('')}
      </div>
    </div>
  `
  }

  // --------------------------------------------------------------
  // FUNCIÓN PRINCIPAL: PEDIR ENTRADA
  // --------------------------------------------------------------
  async function pedirEntrada(evento) {
    try {
      // ==========================================================
      // 🔐 VALIDACIÓN LOGIN
      // ==========================================================
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

        if (res.isConfirmed) abrirLoginGlobal()
        return
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'
      const usuarioEmail = user.email || null

      // ==========================================================
      // 📊 CALCULAR CUPOS REALES
      // ==========================================================
      const { eventoData, maxUser, lotesInfo } = await calcularCuposEvento(
        evento.id,
        usuarioId
      )

      if (maxUser <= 0) {
        await Swal.fire({
          title: 'Límite alcanzado',
          text: 'Ya alcanzaste el máximo de entradas permitidas.',
          icon: 'info',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        })
        return
      }

      // ==========================================================
      // 🎟 EVENTO CON LOTES — MULTI LOTE
      // ==========================================================
      if (Array.isArray(lotesInfo) && lotesInfo.length > 0) {
        const seleccion = await abrirSeleccionLotesMultiPro(evento, lotesInfo)
        if (!seleccion) return

        // ----------------------------------------------------------
        // 🔀 SEPARAR GRATIS VS PAGAS
        // ----------------------------------------------------------
        const gratis = seleccion.filter(
          s => Number(normalizarPrecio(s.lote.precio)) === 0
        )

        const pagas = seleccion.filter(
          s => Number(normalizarPrecio(s.lote.precio)) > 0
        )

        // ----------------------------------------------------------
        // 🟢 CREAR ENTRADAS GRATIS (SIEMPRE, HAYA O NO PAGO)
        // ----------------------------------------------------------
        const soloEntradasFree = gratis.length > 0 && pagas.length === 0

        if (gratis.length > 0) {
          // 👉 Mostrar loading SOLO si luego va a haber pago

          try {
            showLoading({
              title: 'Cargando entradas',
              text: 'Estamos creando tus entradas..',
            })
            for (const g of gratis) {
              await pedirEntradaFreeConLote({
                evento,
                loteSel: g.lote,
                usuarioId,
                usuarioNombre,
                usuarioEmail,
                cantidadSel: g.cantidad,

                // 🔑 CLAVE
                noMostrarSwal: !soloEntradasFree, // ❌ ocultar swal si hay pago
                mostrarQrAlGenerar: false,

                cargarEntradasUsuario,
              })
            }
          } finally {
            if (!soloEntradasFree) {
              hideLoading()
            }
          }
        }

        // ----------------------------------------------------------
        // 🟢 AVISO: ENTRADAS GRATIS GENERADAS (ANTES DEL PAGO)
        // ----------------------------------------------------------
        if (gratis.length > 0 && pagas.length > 0) {
          const totalGratis = gratis.reduce(
            (acc, g) => acc + Number(g.cantidad || 0),
            0
          )

          const resAviso = await Swal.fire({
            title: 'Entradas gratis generadas',
            html: `
      <p>
        Se genero correctamente <b>${totalGratis}</b>
        ${totalGratis === 1 ? 'entrada gratuita' : 'entradas gratuitas'}.
      </p>
      <p class="mt-2">
        A continuación podrás continuar con el pago de las entradas restantes.
      </p>
    `,
            icon: 'success',
            confirmButtonText: 'Continuar al pago',
            allowOutsideClick: false,
            allowEscapeKey: false,
            buttonsStyling: false,
            customClass: {
              confirmButton: 'swal-btn-confirm',
            },
          })

          if (!resAviso.isConfirmed) return
        }

        // ----------------------------------------------------------
        // 📦 ENTRADAS GRATIS (PENDIENTES A POST-PAGO)
        // ----------------------------------------------------------
        const entradasGratisPendientes = gratis.map(s => ({
          lote: s.lote,
          cantidad: Number(s.cantidad),
        }))

        // ⛔ seguridad adicional
        if (pagas.length === 0) return

        // ----------------------------------------------------------
        // 💳 DETALLE DE ENTRADAS PAGAS
        // ----------------------------------------------------------
        const detallesPagos = pagas.map(s => {
          const loteIndice = Number.isFinite(s.lote?.index)
            ? s.lote.index
            : Number.isFinite(s.lote?.loteIndice)
            ? s.lote.loteIndice
            : null

          if (loteIndice === null) {
            console.error('❌ Lote pago sin index/loteIndice:', s.lote)
            throw new Error('Lote inválido: falta index (loteIndice)')
          }

          return {
            lote: s.lote,
            loteIndice,
            loteId: s.lote?.id ?? s.lote?.index ?? loteIndice,
            nombre: s.lote?.nombre || 'Entrada general',
            cantidad: Number(s.cantidad) || 1,
            precio: normalizarPrecio(s.lote?.precio),
          }
        })
        console.table(
          detallesPagos.map(d => ({
            nombre: d.nombre,
            loteIndice: d.loteIndice,
            cantidad: d.cantidad,
            precio: d.precio,
          }))
        )

        const totalPagos = detallesPagos.reduce(
          (acc, d) => acc + d.precio * d.cantidad,
          0
        )

        if (!Number.isFinite(totalPagos) || totalPagos <= 0) {
          await Swal.fire({
            title: 'Error',
            text: 'El monto del pago es inválido.',
            icon: 'error',
          })
          return
        }

        // ----------------------------------------------------------
        // 🧾 HEADER EVENTO (RESUMEN)
        // ----------------------------------------------------------
        const headerEvento = `
        <div class="evento-header center">
          <h2 class="evento-title">${evento.nombre}</h2>

          <div class="evento-meta">
            <span>${formatearSoloFecha(evento.fechaInicio)}</span>
            <span class="evento-dot">•</span>
            <span>${evento.lugar}</span>
          </div>

          <div class="evento-divider"></div>

          <div class="evento-section">
            🎟 Resumen de entradas
          </div>
        </div>
      `

        const metodoPago = await Swal.fire({
          title: '',
          html: `
    ${headerEvento}

    ${renderResumenEntradas({
      gratis,
      pagas: detallesPagos,
    })}

    <p class="total-box">
      Total a pagar: <b>$${totalPagos.toLocaleString('es-AR')}</b>
    </p>

    <div class="metodos-wrapper mt-3 mb-4">
      <button id="mp" class="method-btn method-mp only-logo">
        <img
          src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadopago/logo__large.png"
          class="mp-logo"
        />
      </button>

      <button id="transfer" class="method-btn method-transfer">
        TRANSFERENCIA
      </button>
    </div>
  `,
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          showConfirmButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          buttonsStyling: false,
          didOpen: () => {
            document.getElementById('mp').onclick = () =>
              Swal.close({ isConfirmed: true, value: 'mp' })

            document.getElementById('transfer').onclick = () =>
              Swal.close({ isConfirmed: true, value: 'transfer' })
          },
        })

        if (!metodoPago.isConfirmed) return

        // ----------------------------------------------------------
        // 🚀 MERCADO PAGO
        // ----------------------------------------------------------
        if (metodoPago.value === 'mp') {
          return manejarMercadoPago({
            evento,
            usuarioId,
            eventoId: evento.id,
            entradasGratisPendientes,
            detallesPagos, // ✅ enviar lotes reales
          })
        }

        // ----------------------------------------------------------
        // 🔄 TRANSFERENCIA
        // ----------------------------------------------------------
        const cantidadTotal = detallesPagos.reduce(
          (acc, d) => acc + d.cantidad,
          0
        )

        return manejarTransferencia({
          evento,
          precio: totalPagos,
          cantidadSel: cantidadTotal,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,
          entradasGratisPendientes,
          detallesPagos, // ✅ enviar lotes reales
        })
      }

      // ==========================================================
      // 🎫 EVENTO SIN LOTES
      // ==========================================================
      const misEntradasEvento = misEntradas.filter(
        e => e.eventoId === evento.id
      )

      const pendientesEvento = entradasPendientes.filter(
        e => e.eventoId === evento.id
      )
      const precioEvento = Number(eventoData?.precio || 0)

      if (precioEvento === 0) {
        const resResumen = await abrirResumenLote(
          evento,
          {
            nombre: 'Entrada general',
            precio: 0,
          },
          {
            limiteUsuario: Number(evento.entradasPorUsuario) || 8,
            maxCantidad: Number(evento.entradasPorUsuario) || 8,
            totalObtenidas: misEntradasEvento.length,
            totalPendientes: pendientesEvento.length,
          }
        )

        if (!resResumen || resResumen.cancelado) return

        return pedirEntradaFreeSinLote({
          evento,
          usuarioId,
          usuarioNombre,
          usuarioEmail,
          maxUser,
          cantidadSel: resResumen.cantidad || 1,
          mostrarQrReact,
          cargarEntradasUsuario,
        })
      }

      const resResumen = await abrirResumenLote(
        evento,
        {
          nombre: 'Entrada general',
          precio: precioEvento,
        },
        {
          limiteUsuario: Number(evento.entradasPorUsuario) || 8,
          maxCantidad: Number(evento.entradasPorUsuario) || 8,
          totalObtenidas: misEntradasEvento.length,
          totalPendientes: pendientesEvento.length,
        }
      )

      if (!resResumen || resResumen.cancelado) return

      if (resResumen.metodo === 'transfer') {
        return manejarTransferencia({
          evento,
          precio: precioEvento,
          cantidadSel: resResumen.cantidad || 1,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,

          // 🔥 ESTO ES LO QUE FALTABA
          detallesPagos: [
            {
              lote: {
                id: 'general',
                nombre: 'Entrada general',
                index: 0,
                precio: precioEvento,
              },
              loteIndice: 0,
              loteId: 'general',
              nombre: 'Entrada general',
              cantidad: resResumen.cantidad || 1,
              precio: precioEvento,
            },
          ],
        })
      }

      return manejarMercadoPago({
        evento,
        loteSel: {
          id: 'general',
          nombre: 'Entrada general',
          detalles: [
            {
              nombre: 'Entrada general',
              cantidad: resResumen.cantidad || 1,
              precio: precioEvento,
            },
          ],
        },
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
