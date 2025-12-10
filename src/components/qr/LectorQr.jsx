// --------------------------------------------------------------
// src/components/qr/LectorQr.jsx — Lector QR PRO ULTRA ESTABLE 2025
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

export default function LectorQr() {
  const navigate = useNavigate()

  // UI
  const [modo, setModo] = useState('entradas')
  const [resultado, setResultado] = useState(null)

  // Scanner
  const html5Qr = useRef(null)
  const running = useRef(false)
  const initialized = useRef(false)
  const leyendo = useRef(false)

  // --------------------------------------------------------------
  // INIT
  // --------------------------------------------------------------
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      setTimeout(() => iniciarScanner(), 200)
    }

    return () => detenerScanner()
  }, [])

  // Reiniciar al cambiar modo
  useEffect(() => {
    if (!initialized.current) return
    ;(async () => {
      await detenerScanner()
      setResultado(null)
      setTimeout(() => iniciarScanner(), 200)
    })()
  }, [modo])

  // --------------------------------------------------------------
  // INICIAR SCANNER
  // --------------------------------------------------------------
  async function iniciarScanner() {
    const el = document.getElementById('qr-reader')
    if (!el) {
      setTimeout(iniciarScanner, 100)
      return
    }

    if (running.current) return
    if (iniciarScanner.isStarting) return

    iniciarScanner.isStarting = true

    try {
      if (!html5Qr.current) html5Qr.current = new Html5Qrcode('qr-reader')

      const state = html5Qr.current.getState?.()
      if (state === 1 || state === 2) {
        await detenerScanner()
      }

      const cams = await Html5Qrcode.getCameras()
      if (!cams.length) {
        Swal.fire('Sin cámara', 'No se detectó ninguna cámara.', 'error')
        iniciarScanner.isStarting = false
        return
      }

      await html5Qr.current.start(
        cams[0].id,
        { fps: 10, qrbox: 250 },
        onScanSuccess,
        () => {}
      )

      running.current = true
    } catch (err) {
      console.error('Error cámara:', err)

      if (String(err).includes('transition')) {
        setTimeout(() => iniciarScanner(), 300)
      } else {
        Swal.fire('Error', 'No se pudo iniciar la cámara.', 'error')
      }
    } finally {
      iniciarScanner.isStarting = false
    }
  }

  // --------------------------------------------------------------
  // DETENER SCANNER
  // --------------------------------------------------------------
  async function detenerScanner() {
    if (!html5Qr.current || !running.current) return
    try {
      await html5Qr.current.stop()
    } catch (_) {}
    running.current = false
  }

  // --------------------------------------------------------------
  // LECTURA QR
  // --------------------------------------------------------------
  async function onScanSuccess(text) {
    if (leyendo.current) return
    leyendo.current = true

    try {
      const dec = decodificarQr(text)
      let payload = analizarPayload(dec)

      if (!payload.esEntrada && !payload.esCompra) {
        const idRaw = payload.entradaId || payload.compraId || payload.id
        const auto = await detectarTipoPorFirestore(idRaw)
        payload = { ...payload, ...auto }
      }

      let res = null

      if (modo === 'entradas') {
        if (!payload.esEntrada)
          return mostrarError('QR de COMPRA leído en modo ENTRADAS.')
        res = await validarTicket(payload)
      }

      if (modo === 'caja') {
        if (!payload.esCompra)
          return mostrarError('QR de ENTRADA leído en modo CAJA.')
        res = await validarCompra(payload)
      }

      mostrarResultado(res)
    } finally {
      setTimeout(() => (leyendo.current = false), 1500)
    }
  }

  // --------------------------------------------------------------
  // RESULTADOS
  // --------------------------------------------------------------
  function mostrarResultado(res) {
    if (!res) return
    setResultado(res)
    if (navigator.vibrate) navigator.vibrate(80)

    if (res.ok) {
      if (res.tipo === 'entrada') marcarEntradaUsada(res.data.id)
      if (res.tipo === 'compra') marcarCompraRetirada(res.data.id)
    }
  }

  function mostrarError(msg) {
    setResultado({
      ok: false,
      color: 'red',
      titulo: 'QR incorrecto',
      mensaje: msg,
    })
    if (navigator.vibrate) navigator.vibrate(80)
    leyendo.current = false
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <div className="card shadow-sm p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="fw-bold mb-0">Validador QR</h4>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>

        {/* MODOS */}
        <div className="d-flex gap-2 mb-3">
          <button
            className={
              'btn ' +
              (modo === 'entradas' ? 'btn-danger' : 'btn-outline-danger')
            }
            onClick={() => setModo('entradas')}
          >
            🎫 Entradas
          </button>

          <button
            className={
              'btn ' + (modo === 'caja' ? 'btn-primary' : 'btn-outline-primary')
            }
            onClick={() => setModo('caja')}
          >
            🧾 Caja / Barra
          </button>
        </div>

        {/* SCANNER */}
        <div id="qr-reader" style={{ width: '100%', minHeight: 260 }} />

        {/* RESULTADO */}
        {resultado && (
          <div
            className="mt-3 p-3 rounded"
            style={{
              border: `3px solid ${resultado.color || 'gray'}`,
              background: '#fafafa',
            }}
          >
            <h5
              className="fw-bold"
              style={{ color: resultado.color || 'black' }}
            >
              {resultado.titulo}
            </h5>

            {/* Render HTML seguro */}
            <p dangerouslySetInnerHTML={{ __html: resultado.mensaje }}></p>
          </div>
        )}
      </div>
    </div>
  )
}
