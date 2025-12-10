// --------------------------------------------------------------
// LectorQr.jsx — VERSIÓN FINAL (Entradas / Compras + Auto/Manual)
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { Html5QrcodeScanner } from 'html5-qrcode'

import {
  decodificarQr,
  analizarPayload,
  validarTicket,
  validarCompra,
} from '../../services/lectorQr.js'

import ValidacionResultado from './ValidacionResultado.jsx'

export default function LectorQr() {
  const navigate = useNavigate()

  const initialized = useRef(false)
  const [resultado, setResultado] = useState(null)

  // 🔵 MODOS DE VALIDACIÓN
  const [modo, setModo] = useState('auto') // auto | manual

  // --------------------------------------------------------------
  // Inicializar escáner UNA sola vez
  // --------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: 250 },
      false
    )

    scanner.render(
      async decodedText => {
        if (modo === 'manual') return // no validar automáticamente

        procesarCodigo(decodedText)
      },
      () => {}
    )

    return () => scanner.clear()
  }, [modo])

  // --------------------------------------------------------------
  // PROCESAR CÓDIGO (auto o manual)
  // --------------------------------------------------------------
  async function procesarCodigo(texto) {
    try {
      const payload = decodificarQr(texto)

      if (!payload) {
        setResultado({ ok: false, tipo: 'error', mensaje: 'QR inválido' })
        Swal.fire('QR inválido', 'Código malformado', 'error')
        return
      }

      const tipo = analizarPayload(payload)
      if (!tipo) {
        setResultado({ ok: false, tipo: 'error', mensaje: 'QR desconocido' })
        Swal.fire('Error', 'Código no pertenece a AppBar', 'error')
        return
      }

      if (tipo === 'entrada') {
        const res = await validarTicket(payload.ticketId)
        setResultado({ tipo, ...res })

        Swal.fire({
          title: res.valido ? 'Entrada válida' : 'Entrada inválida',
          text: res.mensaje,
          icon: res.valido ? 'success' : 'error',
        })
      }

      if (tipo === 'compra') {
        const res = await validarCompra(payload.ticketId)
        setResultado({ tipo, ...res })

        Swal.fire({
          title: res.valido ? 'Compra válida' : 'Compra inválida',
          text: res.mensaje,
          icon: res.valido ? 'success' : 'error',
        })
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'No se pudo procesar el QR', 'error')
    }
  }

  // --------------------------------------------------------------
  // Validación manual
  // --------------------------------------------------------------
  function validarManual() {
    const value = document.getElementById('manual-input').value.trim()
    if (!value) return
    procesarCodigo(value)
  }

  // --------------------------------------------------------------
  // Render
  // --------------------------------------------------------------
  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="fw-bold text-center mb-4">Validador de QR</h2>

      {/* Selector de modo */}
      <div className="btn-group w-100 mb-3">
        <button
          className={`btn ${
            modo === 'auto' ? 'btn-success' : 'btn-outline-success'
          }`}
          onClick={() => setModo('auto')}
        >
          Automático
        </button>
        <button
          className={`btn ${
            modo === 'manual' ? 'btn-primary' : 'btn-outline-primary'
          }`}
          onClick={() => setModo('manual')}
        >
          Manual
        </button>
      </div>

      {/* Lector */}
      {modo === 'auto' && <div id="reader" style={{ width: '100%' }}></div>}

      {/* Entrada manual */}
      {modo === 'manual' && (
        <div className="input-group mb-4">
          <input
            id="manual-input"
            className="form-control"
            placeholder="Ingresar código QR"
            onKeyDown={e => e.key === 'Enter' && validarManual()}
          />
          <button className="btn btn-primary" onClick={validarManual}>
            Validar
          </button>
        </div>
      )}

      {/* Resultado visual con colores */}
      {resultado && <ValidacionResultado data={resultado} />}

      <button
        className="btn btn-danger w-100 mt-4"
        onClick={() => navigate('/admin')}
      >
        Volver
      </button>
    </div>
  )
}
