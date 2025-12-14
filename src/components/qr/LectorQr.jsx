// --------------------------------------------------------------
// src/components/qr/LectorQr.jsx — VERSION FINAL 2025 QR PRO
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { Html5Qrcode } from 'html5-qrcode'

import {
  decodificarQr,
  analizarPayload,
  detectarTipoPorFirestore,
  validarTicket,
  validarCompra,
  marcarEntradaUsada,
} from '../../services/lectorQr.js'

import {
  registrarPagoCompra,
  registrarRetiroCompra,
  mostrarComprobanteCaja,
} from '../../services/cajaService.js'

import { db, auth } from '../../Firebase.js'
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  where,
} from 'firebase/firestore'

// --------------------------------------------------------------
// FECHA dd/mm/aaaa
// --------------------------------------------------------------
function fechaLarga(fecha) {
  if (!fecha || !fecha.includes('-')) return 'No definida'
  const [a, m, d] = fecha.split('-')
  return `${d}/${m}/${a}`
}

// --------------------------------------------------------------
// Determinar si un evento está vigente HOY
// --------------------------------------------------------------
function eventoEstaVigente(ev) {
  if (!ev?.fecha) return false
  const hoy = new Date()
  const [a, m, d] = ev.fecha.split('-').map(Number)
  const diaEvento = new Date(a, m - 1, d)

  return (
    diaEvento.getFullYear() === hoy.getFullYear() &&
    diaEvento.getMonth() === hoy.getMonth() &&
    diaEvento.getDate() === hoy.getDate()
  )
}

export default function LectorQr({ modoInicial = 'entradas' }) {
  const navigate = useNavigate()

  // --------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------
  const [modo] = useState(modoInicial) // 'entradas' | 'caja'
  const [resultado, setResultado] = useState(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [eventoInfo, setEventoInfo] = useState(null)
  const [infoAbierto, setInfoAbierto] = useState(false)
  const [pedidoCaja, setPedidoCaja] = useState(null)

  // Scanner refs
  const html5Qr = useRef(null)
  const running = useRef(false)
  const initialized = useRef(false)
  const leyendo = useRef(false)

  // --------------------------------------------------------------
  // BEEP OK
  // --------------------------------------------------------------
  function beep(freq, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration / 1000
      )
      osc.stop(ctx.currentTime + duration / 1000)
    } catch {}
  }

  const beepOk = () => beep(900, 130)

  // --------------------------------------------------------------
  // SELECCIÓN DE EVENTO (ENTRADAS)
  // --------------------------------------------------------------
  useEffect(() => {
    if (modo !== 'entradas') return

    async function cargarEventos() {
      const snap = await getDocs(query(collection(db, 'eventos')))
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (!arr.length) return

      let html = `
        <div style="font-size:15px;margin-bottom:8px">Seleccioná el evento:</div>
        <select id="evento-select" class="swal2-select" style="width:100%;padding:12px">
          <option disabled selected value="">Elegí un evento</option>
      `

      arr.forEach(ev => {
        if (eventoEstaVigente(ev)) {
          html += `<option value="${ev.id}">
            ${ev.nombre} — ${fechaLarga(ev.fecha)}
          </option>`
        }
      })

      html += `</select>`

      const { value } = await Swal.fire({
        title: 'Seleccionar evento',
        html,
        confirmButtonText: 'Continuar',
        allowOutsideClick: false,
        preConfirm: () => {
          const el = document.getElementById('evento-select')
          if (!el?.value) {
            Swal.showValidationMessage('Seleccioná un evento válido')
            return false
          }
          return el.value
        },
      })

      setEventoSeleccionado(value)
      cargarEstadisticasEvento(value)
    }

    cargarEventos()
  }, [modo])

  // --------------------------------------------------------------
  // ESTADÍSTICAS EVENTO
  // --------------------------------------------------------------
  async function cargarEstadisticasEvento(eventoId) {
    const snapEv = await getDoc(doc(db, 'eventos', eventoId))
    if (!snapEv.exists()) return

    const ev = snapEv.data()

    const qTot = query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId)
    )
    const tot = await getDocs(qTot)

    const qUsed = query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId),
      where('usado', '==', true)
    )
    const usados = await getDocs(qUsed)

    setEventoInfo({
      ...ev,
      totales: tot.size,
      usadas: usados.size,
      noUsadas: tot.size - usados.size,
      capacidad: ev.capacidad ?? null,
    })
  }

  // --------------------------------------------------------------
  // SCANNER INIT
  // --------------------------------------------------------------
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      setTimeout(iniciarScanner, 300)
    }
    return () => detenerScanner()
  }, [])

  async function iniciarScanner() {
    const el = document.getElementById('qr-reader')
    if (!el || running.current) return

    if (!html5Qr.current) html5Qr.current = new Html5Qrcode('qr-reader')

    const cams = await Html5Qrcode.getCameras()
    if (!cams.length) {
      Swal.fire('Sin cámara', 'No se detectó cámara.', 'error')
      return
    }

    await html5Qr.current.start(
      cams[cams.length - 1].id,
      { fps: 10, qrbox: 250 },
      onScanSuccess
    )

    running.current = true
  }

  async function detenerScanner() {
    if (!html5Qr.current || !running.current) return
    await html5Qr.current.stop()
    running.current = false
  }

  // --------------------------------------------------------------
  // SCAN SUCCESS
  // --------------------------------------------------------------
  async function onScanSuccess(text) {
    if (leyendo.current) return
    leyendo.current = true

    try {
      const dec = decodificarQr(text)
      let payload = analizarPayload(dec)

      // 1️⃣ Buscar COMPRA por ticketId
      const qCompra = query(
        collection(db, 'compras'),
        where('ticketId', '==', payload.id || payload.ticketId)
      )
      const snapCompra = await getDocs(qCompra)

      if (!snapCompra.empty) {
        payload = {
          ...payload,
          esCompra: true,
          esEntrada: false,
          compraId: snapCompra.docs[0].id,
        }
      } else {
        // 2️⃣ Buscar ENTRADA por doc.id
        const snapEntrada = await getDoc(doc(db, 'entradas', payload.id))

        if (snapEntrada.exists()) {
          payload = {
            ...payload,
            esEntrada: true,
            esCompra: false,
            entradaId: payload.id,
          }
        } else {
          return mostrarError('QR inválido o inexistente.')
        }
      }

      let res

      if (modo === 'entradas') {
        if (!payload.esEntrada)
          return mostrarError('QR de compra no válido para entradas')
        res = await validarTicket(payload, eventoSeleccionado)
      } else {
        if (!payload.esCompra)
          return mostrarError('QR de entrada no válido para caja')
        res = await validarCompra(payload)
      }

      mostrarResultado(res)

      if (res?.ok && res.tipo === 'entrada') {
        await marcarEntradaUsada(res.data.id)
        cargarEstadisticasEvento(res.data.eventoId || eventoSeleccionado)
      }

      if (res?.ok && res.tipo === 'compra') {
        setPedidoCaja(res.data)
      }
    } finally {
      setTimeout(() => (leyendo.current = false), 2500)
    }
  }

  // --------------------------------------------------------------
  // RESULTADO
  // --------------------------------------------------------------
  function mostrarResultado(res) {
    setResultado(res)
    setTimeout(() => setResultado(null), 3500)
    res?.ok && beepOk()
  }

  function mostrarError(msg) {
    mostrarResultado({
      ok: false,
      titulo: 'QR incorrecto',
      mensaje: msg,
    })
  }

  // --------------------------------------------------------------
  // CAJA — CONFIRMACIONES
  // --------------------------------------------------------------
  async function confirmarPago() {
    const r = await Swal.fire({
      title: 'Confirmar pago',
      html: `¿El cliente abonó <b>$${pedidoCaja.total}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cobrar',
    })

    if (!r.isConfirmed) return

    const u = auth.currentUser

    await registrarPagoCompra({
      compraId: pedidoCaja.id,
      compraData: pedidoCaja,
      empleado: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
    })

    setPedidoCaja(p => ({ ...p, estado: 'pagado', pagado: true }))
  }

  async function confirmarEntrega() {
    const r = await Swal.fire({
      title: 'Confirmar entrega',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, entregar',
    })

    if (!r.isConfirmed) return

    const u = auth.currentUser

    await registrarRetiroCompra({
      compraId: pedidoCaja.id,
      compraData: { ...pedidoCaja, estado: 'pagado' },
      empleado: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
      origen: 'qr-caja',
    })

    await mostrarComprobanteCaja({ ...pedidoCaja, estado: 'retirado' })
    setPedidoCaja(null)
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <div className="card p-4">
        <div className="d-flex justify-content-between mb-3">
          <h4>Validador QR</h4>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>
        <div id="qr-reader" />
        {pedidoCaja && (
          <div className="card mt-3 p-3">
            <h5>Pedido #{pedidoCaja.numeroPedido}</h5>

            <p>
              <b>Cliente:</b> {pedidoCaja.usuarioNombre}
            </p>
            <p>
              <b>Lugar:</b> {pedidoCaja.lugar}
            </p>

            <p>
              <b>Estado:</b>{' '}
              <span
                className={
                  pedidoCaja.estado === 'retirado'
                    ? 'text-success'
                    : pedidoCaja.estado === 'pagado'
                    ? 'text-primary'
                    : 'text-warning'
                }
              >
                {pedidoCaja.estado.toUpperCase()}
              </span>
            </p>

            <hr />

            {(pedidoCaja.items || pedidoCaja.carrito || []).map((p, i) => (
              <div key={i} className="d-flex justify-content-between">
                <span>
                  {p.nombre} ×{p.enCarrito}
                </span>
                <span>${p.precio * p.enCarrito}</span>
              </div>
            ))}

            <hr />

            <div className="d-flex justify-content-between fs-5">
              <strong>Total</strong>
              <strong>${pedidoCaja.total}</strong>
            </div>

            {pedidoCaja.estado === 'pendiente' && (
              <button
                className="btn btn-warning w-100 mt-3"
                onClick={confirmarPago}
              >
                Confirmar pago
              </button>
            )}

            {pedidoCaja.estado === 'pagado' && (
              <button
                className="btn btn-success w-100 mt-3"
                onClick={confirmarEntrega}
              >
                Confirmar entrega
              </button>
            )}
          </div>
        )}

        {resultado && (
          <div
            className={`mt-3 p-3 ${
              resultado.ok ? 'text-success' : 'text-danger'
            }`}
          >
            <h5>{resultado.titulo}</h5>
            <p dangerouslySetInnerHTML={{ __html: resultado.mensaje }} />
          </div>
        )}
      </div>
    </div>
  )
}
