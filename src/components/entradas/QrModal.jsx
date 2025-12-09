import './QrModal.css'

export default function QrModal({ qrData, onClose }) {
  if (!qrData) return null

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <h4>Tu entrada</h4>

        <img
          className="qr-grande"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}`}
          alt="qr"
        />

        <button className="btn-cerrar" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
