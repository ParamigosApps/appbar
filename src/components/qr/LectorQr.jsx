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
  marcarCompraRetirada,
} from '../../services/lectorQr.js'

import { db } from '../../Firebase.js'
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

  const [modo] = useState(modoInicial)
  const [resultado, setResultado] = useState(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [eventoInfo, setEventoInfo] = useState(null)
  const [infoAbierto, setInfoAbierto] = useState(false)

  const html5Qr = useRef(null)
  const running = useRef(false)
  const initialized = useRef(false)
  const leyendo = useRef(false) // control de cooldown

  // --------------------------------------------------------------
  // BEEPS
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
  // CARGAR EVENTOS CON SWEETALERT RESPONSIVE
  // --------------------------------------------------------------
  useEffect(() => {
    async function cargarEventos() {
      const snap = await getDocs(query(collection(db, 'eventos')))
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (!arr.length) return

      // Select limpio (SIN duplicado)
      let html = `
        <div style="font-size:15px;margin-bottom:8px;color:#444">Seleccioná el evento a validar:</div>
        <select id="evento-select" class="swal2-select" style="
          width:100%;
          padding:12px;
          font-size:17px;
          border-radius:10px;
          border:1px solid #ccc;
        ">
          <option disabled selected value="">Elegí un evento</option>
      `

      arr.forEach(ev => {
        if (eventoEstaVigente(ev)) {
          html += `
            <option value="${ev.id}">
              ${ev.nombre} — ${fechaLarga(ev.fecha)}
            </option>
          `
        }
      })

      html += `</select>`

      const { value } = await Swal.fire({
        title: 'Seleccionar Evento',
        html,
        confirmButtonText: 'Continuar',
        confirmButtonColor: '#111',
        width: '100%',
        maxWidth: '420px',
        padding: '1rem',
        background: '#fafafa',
        allowOutsideClick: false,
        scrollbarPadding: false,
        didOpen: () => {
          const sel = document.getElementById('evento-select')
          if (sel) sel.style.fontSize = '18px'
        },
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
  }, [])

  // --------------------------------------------------------------
  // ESTADÍSTICAS DEL EVENTO
  // --------------------------------------------------------------
  async function cargarEstadisticasEvento(eventoId) {
    const snapEv = await getDoc(doc(db, 'eventos', eventoId))
    if (!snapEv.exists()) return

    const ev = snapEv.data()

    const fechaEv =
      typeof ev.fecha === 'string' && ev.fecha.includes('-') ? ev.fecha : null

    const horarioEv = ev.horario || 'No especificado'

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
      fecha: fechaEv,
      horario: horarioEv,
      totales: tot.size,
      usadas: usados.size,
      noUsadas: tot.size - usados.size,
      capacidad: ev.capacidad ?? null,
    })
  }

  // --------------------------------------------------------------
  // SCANNER
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
    if (!el) return setTimeout(iniciarScanner, 80)
    if (running.current) return

    if (!html5Qr.current) html5Qr.current = new Html5Qrcode('qr-reader')

    const cams = await Html5Qrcode.getCameras()
    if (!cams.length) {
      Swal.fire('Sin cámara', 'No se detectó cámara disponible.', 'error')
      return
    }

    try {
      await html5Qr.current.start(
        cams[cams.length - 1].id,
        { fps: 10, qrbox: 250 },
        onScanSuccess
      )
      running.current = true
    } catch (err) {
      console.error(err)
    }
  }

  async function detenerScanner() {
    if (!html5Qr.current || !running.current) return
    try {
      await html5Qr.current.stop()
    } catch {}
    running.current = false
  }

  // --------------------------------------------------------------
  // RESULTADO QR (con cooldown SIN pisar mensajes)
  // --------------------------------------------------------------
  async function onScanSuccess(text) {
    if (leyendo.current) return
    leyendo.current = true

    try {
      const dec = decodificarQr(text)
      let payload = analizarPayload(dec)

      if (!payload.esEntrada && !payload.esCompra) {
        const idRaw = payload.entradaId || payload.compraId || payload.id
        payload = { ...payload, ...(await detectarTipoPorFirestore(idRaw)) }
      }

      let res = null

      if (modo === 'entradas') {
        if (!payload.esEntrada)
          return mostrarError('Este QR es de COMPRA, no de ENTRADA.')
        res = await validarTicket(payload, eventoSeleccionado)
      } else {
        if (!payload.esCompra)
          return mostrarError('Este QR es de ENTRADA, no de COMPRA.')
        res = await validarCompra(payload)
      }

      mostrarResultado(res)

      if (res?.ok && modo === 'entradas') {
        await marcarEntradaUsada(res.data.id)
        await cargarEstadisticasEvento(res.data.eventoId || eventoSeleccionado)
      }
    } finally {
      setTimeout(() => {
        leyendo.current = false
      }, 2500)
    }
  }

  // --------------------------------------------------------------
  // MOSTRAR RESULTADO (dura 3.5s)
  // --------------------------------------------------------------
  function mostrarResultado(res) {
    setResultado(res)
    setTimeout(() => setResultado(null), 3500)

    navigator.vibrate?.([120, 80, 120])
    res?.ok && beepOk()

    if (res?.ok && res.tipo === 'compra') marcarCompraRetirada(res.data.id)
  }

  function mostrarError(msg) {
    mostrarResultado({
      ok: false,
      titulo: 'QR incorrecto',
      mensaje: msg,
    })
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <div className="card qr-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="fw-bold mb-0">Validador QR</h4>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>

        <div className="mb-3">
          <span className="badge bg-dark p-2">
            Modo: {modo === 'entradas' ? 'Entradas' : 'Caja / Barra'}
          </span>
        </div>

        {/* PANEL DESPLEGABLE DE ESTADISTICAS */}
        {eventoInfo && (
          <div className="evento-info-card mb-3">
            <div
              className="evento-info-header"
              onClick={() => setInfoAbierto(!infoAbierto)}
            >
              <strong>{eventoInfo.nombre}</strong>
              <span>{infoAbierto ? '▲' : '▼'}</span>
            </div>

            {infoAbierto && (
              <div className="evento-info-body">
                <p>
                  <strong>Fecha:</strong>{' '}
                  {eventoInfo.fecha
                    ? fechaLarga(eventoInfo.fecha)
                    : 'No definida'}
                </p>
                <p>
                  <strong>Horario:</strong> {eventoInfo.horario}
                </p>

                <div className="evento-stats">
                  {eventoInfo.capacidad && (
                    <div>
                      <strong>Capacidad:</strong> {eventoInfo.capacidad}
                    </div>
                  )}
                  <div>
                    <strong>Emitidas:</strong> {eventoInfo.totales}
                  </div>
                  <div>
                    <strong>Escaneadas:</strong> {eventoInfo.usadas}
                  </div>
                  <div>
                    <strong>Restantes:</strong> {eventoInfo.noUsadas}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div id="qr-reader" className="qr-reader-box" />

        {resultado && (
          <div
            className={`qr-result mt-3 p-3 rounded ${
              resultado.ok ? 'qr-result-ok' : 'qr-result-error'
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
