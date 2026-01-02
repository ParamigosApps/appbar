export default function EntradaEventoCard({
  nombreEvento,
  fechaEvento,
  horaInicio,
  horaFin,
  lugar,
  cantidad = 1,
  metodo,
  estado, // 'usada' | 'expirada' | 'disponible'
  usadoEn,
  creadoEn,
  children, // para MisEntradas (QR, acciones)
}) {
  const estadoBadge =
    estado === 'usada' ? (
      <span className="badge bg-success">Usada</span>
    ) : estado === 'expirada' ? (
      <span className="badge bg-danger">Expirada</span>
    ) : (
      <span className="badge bg-primary">Disponible</span>
    )

  return (
    <div className="card historial-card mb-3">
      <div className="card-body">
        {/* HEADER */}
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <h5 className="evento-title mb-0">{nombreEvento}</h5>

            <div className="evento-meta">
              📅 {fechaEvento} — ⏰ {horaInicio} a {horaFin}
            </div>

            {lugar && <div className="evento-meta">📍 {lugar}</div>}
          </div>

          {estadoBadge}
        </div>

        <div className="evento-divider" />

        {/* INFO */}
        <div className="d-flex flex-wrap gap-2 mb-2">
          <span className="badge bg-secondary">
            🎟 {cantidad} {cantidad > 1 ? 'entradas' : 'entrada'}
          </span>

          <span className="badge bg-light text-dark border">
            {metodo === 'free' ? 'Entrada gratuita' : metodo?.toUpperCase()}
          </span>
        </div>

        {/* ESTADO */}
        {usadoEn && (
          <div className="validacion-box">
            ✅ <strong>Validada</strong> el {usadoEn}
          </div>
        )}

        {creadoEn && (
          <div className="text-muted small mt-1">Creada el {creadoEn}</div>
        )}

        {/* EXTENSIÓN */}
        {children}
      </div>
    </div>
  )
}
