// --------------------------------------------------------------
// src/context/QrContext.jsx — MODAL GLOBAL QR (ENTRADAS)
// --------------------------------------------------------------
import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { generarEntradaQr } from '../services/generarQrService.js'

const QrContext = createContext()
export const useQr = () => useContext(QrContext)

export function QrProvider({ children }) {
  const [qrData, setQrData] = useState(null)
  const [visible, setVisible] = useState(false)

  const qrRef = useRef(null)

  // ---------------------------
  // Abrir modal QR
  // ---------------------------
  function mostrarQrReact(data) {
    console.log('📌 mostrarQrReact() →', data)
    setQrData(data)
    setVisible(true)
  }

  // ---------------------------
  // Cerrar modal
  // ---------------------------
  function cerrarQr() {
    console.log('❌ cerrarQr()')
    setVisible(false)
    setQrData(null)
  }

  // ---------------------------
  // Generar QR cuando llega data
  // ---------------------------
  useEffect(() => {
    if (!visible || !qrData) return
    if (!qrRef.current) return

    console.log('⚙ Generando QR de ENTRADA con ticketId:', qrData.ticketId)

    qrRef.current.innerHTML = ''

    generarEntradaQr({
      ticketId: qrData.ticketId,
      qrContainer: qrRef.current,
    })
      .then(() => console.log('✅ QR ENTRADA generado OK'))
      .catch(err => console.error('❌ ERROR generando QR ENTRADA:', err))
  }, [qrData, visible])

  return (
    <QrContext.Provider value={{ mostrarQrReact, cerrarQr }}>
      {children}

      {visible && (
        <div
          className="qr-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          onClick={cerrarQr}
        >
          <div
            className="qr-modal-content"
            style={{
              background: 'var(--bs-body-bg)',
              color: 'var(--bs-body-color)',
              padding: 20,
              borderRadius: 14,
              width: '90%',
              maxWidth: 360,
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 className="mb-3">{qrData?.nombreEvento}</h4>

            {/* QR REAL */}
            <div
              ref={qrRef}
              id="qrGlobalContainer"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}
            ></div>

            <p>{qrData?.fecha}</p>
            <p>{qrData?.lugar}</p>
            <p>{qrData?.horario}</p>
            <p>{qrData?.precio}</p>

            <button className="btn btn-dark mt-3 w-100" onClick={cerrarQr}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </QrContext.Provider>
  )
}
