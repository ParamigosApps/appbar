// src/pages/pago/BasePagoLayout.jsx
export default function BasePagoLayout({ icon, title, description, children }) {
  return (
    <div className="pago-page">
      <div className="pago-card">
        <div className="pago-icon">{icon}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="pago-actions">{children}</div>
      </div>
    </div>
  )
}
