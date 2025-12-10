// --------------------------------------------------------------
// LectorQr.jsx — VERSIÓN FINAL 2025 FUNCIONAL
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5QrcodeScanner } from 'html5-qrcode'

import {
  decodificarQr,
  analizarPayload,
  validarTicket,
  validarCompra,
  marcarEntradaUsada,
  marcarCompraRetirada,
} from '../../services/lectorQr.js'

export default function LectorQr() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const initialized = useRef(false)

  const [modo, setModo] = useState('entradas') // entradas | caja
  const [resultado, setResultado] = useState(null)

  // --------------------------------------------------------------
  // INICIALIZAR SCANNER UNA SOLA VEZ
  // --------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
      },
      false
    )

    scanner.render(onScanSuccess, onScanError)
    scannerRef.current = scanner
  }, [])

  // --------------------------------------------------------------
  // CALLBACK SCAN OK
  // --------------------------------------------------------------
  async function onScanSuccess(text) {
    try {
      const dec = decodificarQr(text)
      const payload = analizarPayload(dec)

      // VALIDACIÓN POR MODO
      let res = null

      if (modo === 'entradas') {
        if (!payload.esEntrada) {
          setResultado({
            color: 'red',
            titulo: 'QR incorrecto',
            mensaje: 'Este QR es de COMPRA, no de ENTRADA.',
          })
          return
        }
        res = await validarTicket(payload)
      }

      if (modo === 'caja') {
        if (!payload.esCompra) {
          setResultado({
            color: 'red',
            titulo: 'QR incorrecto',
            mensaje: 'Este QR es de ENTRADA, no de COMPRA.',
          })
          return
        }
        res = await validarCompra(payload)
      }

      setResultado(res)
    } catch (err) {
      setResultado({
        color: 'red',
        titulo: 'Error',
        mensaje: 'No se pudo procesar el QR.',
      })
    }
  }

  // --------------------------------------------------------------
  // ERRORES DE ESCANEO (ruido normal)
  // --------------------------------------------------------------
  function onScanError(err) {
    // se ignora el spam
  }

  // --------------------------------------------------------------
  // ACCIONES DE CONFIRMACIÓN
  // --------------------------------------------------------------
  async function confirmarAccion() {
    if (!resultado?.data) return

    if (resultado.tipo === 'entrada') {
      await marcarEntradaUsada(resultado.data.id)
      setResultado({ ...resultado, estado: 'usada-confirmada' })
    }

    if (resultado.tipo === 'compra') {
      await marcarCompraRetirada(resultado.data.id)
      setResultado({ ...resultado, estado: 'retirada-confirmada' })
    }
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <div className="card shadow p-4">
        {/* HEADER */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="fw-bold mb-0">Validador QR</h4>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>

        {/* BOTONES DE MODO */}
        <div className="d-flex gap-2 mb-3">
          <button
            className={
              'btn ' +
              (modo === 'entradas'
                ? 'btn-danger text-white'
                : 'btn-outline-danger')
            }
            onClick={() => setModo('entradas')}
          >
            🎟️ Entradas
          </button>

          <button
            className={
              'btn ' +
              (modo === 'caja'
                ? 'btn-primary text-white'
                : 'btn-outline-primary')
            }
            onClick={() => setModo('caja')}
          >
            🧾 Caja / Barra
          </button>
        </div>

        {/* CONTENEDOR DEL QR SCANNER */}
        <div id="qr-reader" style={{ width: '100%' }}></div>

        {/* RESULTADO */}
        {resultado && (
          <div
            className="mt-4 p-3 rounded"
            style={{
              background:
                resultado.color === 'green'
                  ? '#d4edda'
                  : resultado.color === 'pink'
                  ? '#fce4ec'
                  : resultado.color === 'purple'
                  ? '#ede7f6'
                  : resultado.color === 'blue'
                  ? '#e3f2fd'
                  : resultado.color === 'yellow'
                  ? '#fff9c4'
                  : '#f8d7da',
              borderLeft: '6px solid ' + resultado.color,
            }}
          >
            <h5 className="fw-bold">{resultado.titulo}</h5>
            <p className="mb-2">{resultado.mensaje}</p>

            {/* BOTÓN CONFIRMAR */}
            {resultado.ok && (
              <button className="btn btn-success" onClick={confirmarAccion}>
                Confirmar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
