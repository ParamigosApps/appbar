// --------------------------------------------------------------
// LectorQr.jsx — VERSIÓN FINAL DEFINITIVA (Html5Qrcode)
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const [params] = useSearchParams()
  const modo = params.get('modo') || 'entradas'

  const initialized = useRef(false)
  const [resultado, setResultado] = useState(null)

  // --------------------------------------------------------------
  // Inicializar el escáner UNA sola vez
  // --------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const scanner = new Html5QrcodeScanner(
      'reader',
      {
        fps: 10,
        qrbox: 250,
      },
      false
    )

    scanner.render(
      async decodedText => {
        try {
          // 1) Decodificar
          const payload = decodificarQr(decodedText)

          if (!payload) {
            Swal.fire('QR inválido', 'No contiene estructura válida', 'error')
            setResultado({
              ok: false,
              tipo: 'error',
              mensaje: 'QR inválido',
            })
            return
          }

          // 2) Saber si es "entrada" o "compra"
          const tipo = analizarPayload(payload)

          if (!tipo) {
            Swal.fire('Error', 'Formato de QR desconocido', 'error')
            setResultado({
              ok: false,
              tipo: 'desconocido',
              mensaje: 'El QR no es de AppBar',
            })
            return
          }

          // 3) Validar según tipo
          if (tipo === 'entrada') {
            const res = await validarTicket(payload.ticketId)
            setResultado({ tipo, ...res })

            if (res.valido) Swal.fire('Entrada válida', res.mensaje, 'success')
            else Swal.fire('Entrada inválida', res.mensaje, 'error')
          }

          if (tipo === 'compra') {
            const res = await validarCompra(payload.ticketId)
            setResultado({ tipo, ...res })

            if (res.valido) Swal.fire('Compra válida', res.mensaje, 'success')
            else Swal.fire('Compra inválida', res.mensaje, 'error')
          }
        } catch (err) {
          console.error(err)
          Swal.fire('Error', 'Falló el procesamiento del QR', 'error')
        }
      },
      errorMessage => {
        // Ignorar errores menores del escáner
      }
    )

    return () => {
      scanner.clear()
    }
  }, [])

  // --------------------------------------------------------------
  // Validación manual (input)
  // --------------------------------------------------------------
  async function validarManual() {
    const v = document.getElementById('manual-input')?.value.trim()
    if (!v) return

    try {
      const payload = decodificarQr(v)
      if (!payload) {
        Swal.fire('Error', 'QR inválido o malformado', 'error')
        return
      }

      const tipo = analizarPayload(payload)
      if (!tipo) {
        Swal.fire('Desconocido', 'El QR no es de AppBar', 'error')
        return
      }

      if (tipo === 'entrada') {
        const res = await validarTicket(payload.ticketId)
        setResultado({ tipo, ...res })

        if (res.valido) Swal.fire('Entrada válida', res.mensaje, 'success')
        else Swal.fire('Entrada inválida', res.mensaje, 'error')
      }

      if (tipo === 'compra') {
        const res = await validarCompra(payload.ticketId)
        setResultado({ tipo, ...res })

        if (res.valido) Swal.fire('Compra válida', res.mensaje, 'success')
        else Swal.fire('Compra inválida', res.mensaje, 'error')
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Error', 'No se pudo procesar el código', 'error')
    }
  }

  // --------------------------------------------------------------
  // Render UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4 text-center">
        {modo === 'compras' ? 'Validador de Compras' : 'Validador de Entradas'}
      </h2>

      {/* Scanner */}
      <div id="reader" style={{ width: '100%' }}></div>

      {/* Resultado visual */}
      {resultado && (
        <div className="mt-4">
          <ValidacionResultado data={resultado} />
        </div>
      )}

      {/* Entrada manual */}
      <div className="input-group mt-4">
        <input
          id="manual-input"
          className="form-control"
          placeholder="Código manual"
          onKeyDown={e => {
            if (e.key === 'Enter') validarManual()
          }}
        />

        <button className="btn btn-primary" onClick={validarManual}>
          Validar
        </button>
      </div>

      {/* Volver */}
      <button
        className="btn btn-danger w-100 mt-4"
        onClick={() => navigate('/admin')}
      >
        Volver al panel
      </button>
    </div>
  )
}
