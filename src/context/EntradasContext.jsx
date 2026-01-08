// --------------------------------------------------------------
// src/context/EntradasContext.jsx — VERSIÓN FINAL ESTABLE 2025
// --------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
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

// SWALS
import {
  abrirResumenLote,
  abrirSeleccionLotesMultiPro,
} from '../services/entradasSwal.js'

import { showLoading, hideLoading } from '../services/loadingService'
import { formatearSoloFecha } from '../utils/utils'
import { mostrarResultadoEntradasGratis } from '../utils/swalUtils'
// --------------------------------------------------------------
// CONTEXTO
// --------------------------------------------------------------
const EntradasContext = createContext()
export const useEntradas = () => {
  const ctx = useContext(EntradasContext)
  if (!ctx) {
    throw new Error(
      'useEntradas debe usarse dentro de EntradasProvider (import/context duplicado)'
    )
  }
  return ctx
}

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
  const { user } = useAuth()
  const [flujoPagoActivo, setFlujoPagoActivo] = useState(false)

  function renderResultadoEntradas({ evento, exitosas, fallidas }) {
    // -----------------------------
    // ✅ AGRUPAR EXITOSAS POR LOTE
    // -----------------------------
    const okAgrupadas = {}

    exitosas.forEach(e => {
      const nombreLote = e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada'

      okAgrupadas[nombreLote] =
        (okAgrupadas[nombreLote] || 0) + Number(e.cantidad || 0)
    })

    const okHtml = Object.entries(okAgrupadas)
      .map(([nombre, cant]) => `<li><b>${nombre}</b> x${cant}</li>`)
      .join('')

    // -----------------------------
    // ❌ AGRUPAR FALLIDAS POR LOTE + ERROR
    // -----------------------------
    const errAgrupadas = {}

    fallidas.forEach(e => {
      const lote =
        e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada general'

      const motivoBase = e.error || 'No se pudo generar la entrada'
      const solicitadas = Number(e.cantidad || 0)
      const permitidas = Number.isFinite(e.maxDisponible)
        ? Number(e.maxDisponible)
        : null

      if (!errAgrupadas[lote]) {
        errAgrupadas[lote] = {
          lote,
          solicitadas: 0,
          permitidas,
          motivoBase,
        }
      }

      errAgrupadas[lote].solicitadas += solicitadas
    })

    const errHtml = Object.values(errAgrupadas)
      .map(
        e => `
        <li>
          <b>${e.nombreLote}</b> x${e.cantidad}<br/>
          <small style="color:#b00020;">
            Motivo: ${e.error}
          </small>
        </li>
      `
      )
      .join('')

    // -----------------------------
    // 🎨 HTML FINAL
    // -----------------------------
    return `
    <div style="text-align:center; margin-bottom:10px;">
      <h2 style="margin-bottom:4px;">🎟 ${evento?.nombre || 'Evento'}</h2>
      ${
        evento?.fechaInicio
          ? `<small>${formatearSoloFecha(evento.fechaInicio)}</small>`
          : ''
      }
    </div>

    ${
      okHtml
        ? `
        <h4 style="margin-top:16px;">Entradas generadas</h4>
        <ul style="text-align:left;">${okHtml}</ul>
      `
        : ''
    }

    ${
      errHtml
        ? `
        <h4 style="margin-top:16px; color:#b00020;">
          ⚠️ Entradas no generadas
        </h4>
        <ul style="text-align:left;">${errHtml}</ul>
      `
        : ''
    }
  `
  }

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

        const arr = snap.docs.map(d => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            horaInicio: data.horaInicio || '',
            horaFin: data.horaFin || '',
          }
        })

        arr.sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
        setEventos(arr)
      } catch (e) {
        console.error('❌ Error cargando eventos:', e)
      }
      setLoadingEventos(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (!user?.uid) {
      setHistorialEntradas([])
      return
    }

    cargarHistorial(user.uid)
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    if (flujoPagoActivo) return
    if (window.location.pathname.includes('/pago-resultado')) return
    if (Swal.isVisible()) return

    // Solo entradas GRATIS no notificadas
    const gratis = entradasPendientes.filter(
      e => e._tipo === 'gratis' && !e.notificado
    )

    if (gratis.length === 0) return

    // Agrupar por evento
    const porEvento = {}
    gratis.forEach(e => {
      if (!porEvento[e.eventoId]) porEvento[e.eventoId] = []
      porEvento[e.eventoId].push(e)
    })

    // Procesar evento por evento
    for (const eventoId of Object.keys(porEvento)) {
      const items = porEvento[eventoId]

      // Esperar a que TODAS estén resueltas
      const todasResueltas = items.every(
        e => e.estado === 'procesado' || e.estado === 'error'
      )
      if (!todasResueltas) continue

      const exitosas = items.filter(e => e.estado === 'procesado')
      const fallidas = items.filter(e => e.estado === 'error')

      if (exitosas.length === 0 && fallidas.length === 0) continue

      const evento = eventos.find(ev => ev.id === eventoId) || null

      // -----------------------------
      // 🔐 LOCK OPTIMISTA (CLAVE)
      // -----------------------------
      items.forEach(e => {
        updateDoc(doc(db, 'entradasGratisPendientes', e.id), {
          notificado: true,
        })
      })

      // -----------------------------
      // 🧾 ARMAR HTML RESULTADO
      // -----------------------------
      const okAgrupadas = {}
      exitosas.forEach(e => {
        const nombre = e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada'
        okAgrupadas[nombre] =
          (okAgrupadas[nombre] || 0) + Number(e.cantidad || 0)
      })

      const okHtml = Object.entries(okAgrupadas)
        .map(([nombre, cant]) => `<li><b>${nombre}</b> x${cant}</li>`)
        .join('')

      const errAgrupadas = {}
      fallidas.forEach(e => {
        const nombre = e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada'
        const error = e.error || 'No se pudo generar la entrada'
        const key = `${nombre}__${error}`

        if (!errAgrupadas[key]) {
          errAgrupadas[key] = {
            nombre,
            error,
            cantidad: 0,
            maxDisponible: e.maxDisponible,
          }
        }

        errAgrupadas[key].cantidad += Number(e.cantidad || 0)
      })

      const errHtml = Object.values(errAgrupadas)
        .map(e => {
          const cupoInfo =
            typeof e.maxDisponible === 'number'
              ? `<br/><small>
                Disponibles: ${e.maxDisponible}
              </small>`
              : ''

          return `
          <li>
            <b>${e.nombre}</b> x${e.cantidad}<br/>
            <small style="color:#b00020;">${e.error}</small>
            ${cupoInfo}
          </li>
        `
        })
        .join('')

      const html = `
      <div style="text-align:center; margin-bottom:10px;">
        <h2 style="margin-bottom:4px;">🎟 ${evento?.nombre || 'Evento'}</h2>
        ${
          evento?.fechaInicio
            ? `<small>${formatearSoloFecha(evento.fechaInicio)}</small>`
            : ''
        }
      </div>

      ${
        okHtml
          ? `
          <h4 style="margin-top:16px;">✅ Entradas confirmadas</h4>
          <ul style="text-align:left;">${okHtml}</ul>
        `
          : ''
      }

      ${
        errHtml
          ? `
          <h4 style="margin-top:16px; color:#b00020;">
            ❌ Entradas no generadas
          </h4>
          <ul style="text-align:left;">${errHtml}</ul>
        `
          : ''
      }
    `

      // -----------------------------
      // 🔔 SWAL FINAL (UNO SOLO)
      // -----------------------------
      mostrarResultadoEntradasGratis({
        evento,
        exitosas,
        fallidas,
        onConfirm: () =>
          document.dispatchEvent(new Event('abrir-mis-entradas')),
      })

      // ⚠️ IMPORTANTE: salir para evitar múltiples Swals simultáneos
      break
    }
  }, [entradasPendientes, flujoPagoActivo, user, eventos])

  useEffect(() => {
    if (!user?.uid) {
      setMisEntradas([])
      return
    }

    const q = query(
      collection(db, 'entradas'),
      where('usuarioId', '==', user.uid)
    )

    const unsub = onSnapshot(q, snap => {
      setMisEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return unsub
  }, [user])
  // ----------------------------------------------------------
  // ESCUCHAR ENTRADAS PENDIENTES (PAGAS + GRATIS)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!user?.uid) {
      setEntradasPendientes([])
      return
    }

    const qPagas = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const qGratis = query(
      collection(db, 'entradasGratisPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const unsubPagas = onSnapshot(qPagas, snap => {
      const pagas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      setEntradasPendientes(prev => {
        const soloGratis = prev.filter(p => p._tipo === 'gratis')
        return [...soloGratis, ...pagas]
      })
    })

    const unsubGratis = onSnapshot(qGratis, snap => {
      const gratis = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        _tipo: 'gratis',
      }))

      setEntradasPendientes(prev => {
        const soloPagas = prev.filter(p => p._tipo !== 'gratis')
        return [...soloPagas, ...gratis]
      })
    })

    return () => {
      unsubPagas()
      unsubGratis()
    }
  }, [user])

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

  function generarEntradasGratis({
    evento,
    usuarioId,
    usuarioNombre,
    usuarioEmail,
    gratis,
  }) {
    for (const g of gratis) {
      // 🔥 SOLO ENCOLA, NO ESPERA
      pedirEntradaFreeConLote({
        evento,
        loteSel: g.lote,
        usuarioId,
        usuarioNombre,
        usuarioEmail,
        cantidadSel: g.cantidad,
      })
    }

    // UI feedback inmediato
    return true
  }

  function renderResumenEntradas({ gratis = [], pagas = [] }) {
    const rowsGratis = gratis.map(g => {
      const loteIndice = Number.isFinite(g.lote?.index)
        ? g.lote.index
        : Number.isFinite(g.lote?.loteIndice)
        ? g.lote.loteIndice
        : null

      const aprobadas = misEntradas.filter(
        e => e.eventoId === g.eventoId && e.loteIndice === loteIndice
      ).length

      const estado = aprobadas >= g.cantidad ? 'Aprobada' : 'En proceso'
      const clase = estado === 'Aprobada' ? 'badge-aprobada' : 'badge-generadas'

      return `
    <div class="limite-row entrada gratis">
      <span class="label">
        ${g.lote.nombre} x<span class="cantidad">${g.cantidad}</span>
        <span class="${clase}">${estado}</span>
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
  async function pedirEntrada(evento, payload = {}) {
    try {
      showLoading({
        title: 'Cargando evento',
        text: 'Estamos cargando la información del evento..',
      })
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

      const usuarioId = payload.usuarioId || user?.uid
      const usuarioNombre =
        payload.usuarioNombre ?? user?.displayName ?? user?.email ?? 'Usuario'

      const usuarioEmail = user?.email || null

      if (!usuarioId) {
        throw new Error('usuarioId requerido para pedir entrada')
      }

      // ==========================================================
      // 📊 CALCULAR CUPOS REALES
      // ==========================================================
      const { eventoData, maxUser, lotesInfo } = await calcularCuposEvento(
        evento.id,
        usuarioId
      )

      // 🔑 Asegurar datos por usuario en cada lote
      const lotesInfoConUsuario = lotesInfo.map(l => ({
        ...l,
        cantidad: Number(l.cantidad), // stock global REAL
        disponiblesUsuario: Number(l.disponiblesUsuario), // NUEVO
      }))

      // ==========================================================
      // 🧮 MAPAS DE CUPOS POR LOTE (CLAVE)
      // ==========================================================
      const entradasUsuarioPorLote = {}
      const pendientesUsuarioPorLote = {}
      const usadosPorLote = {}

      lotesInfoConUsuario.forEach(l => {
        const idx = Number.isFinite(l.index)
          ? l.index
          : Number.isFinite(l.loteIndice)
          ? l.loteIndice
          : null

        if (idx === null) return
        console.table({
          lote: l.nombre,
          cantidadInicial: l.cantidadInicial,
          cantidad: l.cantidad,
          maxPorUsuario: l.maxPorUsuario,
          usadas: l.usadasPorUsuario,
          pendientes: l.pendientesPorUsuario,
        })

        // ✔ usadas CONFIRMADAS por lote
        entradasUsuarioPorLote[idx] = Number(l.usadasPorUsuario || 0)

        // ✔ pendientes por lote (si existen)
        pendientesUsuarioPorLote[idx] = entradasPendientes
          .filter(p => p.loteIndice === idx)
          .reduce((acc, p) => acc + Number(p.cantidad || 0), 0)
        usadosPorLote[idx] = Number(l.usados || 0)
      })

      const eventoCompleto = {
        ...eventoData,
        ...evento,
        id: evento.id,
        horaInicio: eventoData?.horaInicio || evento.horaInicio || '',
        horaFin: eventoData?.horaFin || evento.horaFin || '',
      }

      // ⛔ SOLO bloquear por límite GLOBAL si NO hay lotes
      if (
        maxUser <= 0 &&
        (!Array.isArray(lotesInfo) || lotesInfo.length === 0)
      ) {
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
        const eventoParaSeleccion = {
          id: evento.id,
          nombre: evento.nombre,
          fechaInicio: evento.fechaInicio,
          horaInicio: evento.horaInicio || '',
          horaFin: evento.horaFin || '',
          lugar: evento.lugar,
          entradasPorUsuario: evento.entradasPorUsuario,
        }

        const seleccion = await abrirSeleccionLotesMultiPro(
          eventoParaSeleccion,
          lotesInfoConUsuario,
          {
            entradasUsuarioPorLote,
            pendientesUsuarioPorLote,
            usadosPorLote,
          }
        )

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

        if (gratis.length > 0) {
          try {
            await generarEntradasGratis({
              evento: eventoCompleto,
              usuarioId,
              usuarioNombre,
              usuarioEmail,
              gratis,
            })

            if (pagas.length > 0) setFlujoPagoActivo(true)

            await Swal.fire({
              icon: 'info',
              title: 'Entradas en proceso',
              html: `
              
              <p>Esto puede demorar unos segundos.</p>
              <p><b>Las vas a ver automáticamente en “Mis Entradas”.</b></p>
            `,
              confirmButtonText: 'Aceptar',
              buttonsStyling: false,
              customClass: {
                confirmButton: 'swal-btn-confirm',
              },
            })
          } catch (e) {
            console.error('❌ Error generando entradas gratis:', e)
          }

          if (pagas.length === 0) return
        }

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

    <p class="total-box mt-2">
      <b>TOTAL: $${totalPagos.toLocaleString('es-AR')}</b>
    </p>

    <div class="metodos-pago-box">
  <p class="metodos-title">¿Cómo querés pagar?</p>
      <div class="metodos-wrapper mt-3 mb-5">
      <button id="mp" class="method-btn method-mp only-logo">
        <img
          src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadopago/logo__large.png"
          class="mp-logo"
        />
      </button>

      <button id="transfer" class="method-btn method-transfer">
        Transferencia
      </button>
          </div>
      </div>
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
            evento: eventoCompleto,
            usuarioId,
            usuarioNombre: user.nombre || user.displayName || '',
            usuarioEmail: user.email || '',
            eventoId: evento.id,
            loteSel: {
              id: 'multi',
              nombre: 'Entradas',
              detalles: detallesPagos.map(d => ({
                nombre: d.nombre,
                cantidad: d.cantidad,
                precio: d.precio,
              })),
            },
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
          evento: eventoCompleto,
          precio: totalPagos,
          cantidadSel: cantidadTotal,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,
          detallesPagos,
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
          eventoCompleto,
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
        })
      }

      const resResumen = await abrirResumenLote(
        eventoCompleto,
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
          evento: eventoCompleto,
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
        usuarioNombre,
        usuarioEmail,
        eventoId: evento.id,
      })
    } catch (err) {
      setFlujoPagoActivo(false)
      console.error('❌ ERROR pedirEntrada:', err)
      Swal.fire('Error', 'Ocurrió un error inesperado.', 'error')
    } finally {
      setFlujoPagoActivo(false)
      hideLoading()
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
        cargarEntradasUsadas,
        cargarHistorial,
      }}
    >
      {children}
    </EntradasContext.Provider>
  )
}
