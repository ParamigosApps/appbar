import MostrarQr from './MostrarQr.jsx'

export default function QrModal({ open, payload, onClose }) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '350px',
        }}
      >
        {/* ⬇ Enviamos SOLO el texto del QR */}
        <MostrarQr payload={payload.qrText} onClose={onClose} />
      </div>
    </div>
  )
}
