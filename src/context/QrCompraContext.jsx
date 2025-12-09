// src/context/QrCompraContext.jsx
import { createContext, useState, useContext, useRef, useEffect } from 'react'
import QRCode from 'qrcodejs2-fix'

const QrCompraContext = createContext()
export const useQrCompra = () => useContext(QrCompraContext)

export function QrCompraProvider({ children }) {
  const [data, setData] = useState(null)
  const [visible, setVisible] = useState(false)
  const qrRef = useRef(null)

  function mostrarQrCompra(data) {
    console.log('📌 mostrarQrCompra:', data)
    setData(data)
    setVisible(true)
  }

  function cerrarQrCompra() {
    console.log('❌ cerrarQrCompra')
    setVisible(false)
    setData(null)
  }

  useEffect(() => {
    if (!visible || !data || !qrRef.current) return

    qrRef.current.innerHTML = ''

    new QRCode(qrRef.current, {
      text: `Compra:${data.ticketId}`,
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M,
    })

    console.log('✅ QR Compra generado')
  }, [visible, data])

  return (
    <QrCompraContext.Provider value={{ mostrarQrCompra, cerrarQrCompra }}>
      {children}

      {visible && (
        <div
          className="qr-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
          }}
          onClick={cerrarQrCompra}
        >
          <div
            className="qr-modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              width: '90%',
              maxWidth: 360,
            }}
          >
            <h4 className="text-center mb-3">{data?.titulo}</h4>

            <div
              ref={qrRef}
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            />

            <button className="btn btn-dark w-100" onClick={cerrarQrCompra}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </QrCompraContext.Provider>
  )
}
