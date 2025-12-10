// --------------------------------------------------------------
// ValidacionResultado.jsx — Tarjeta visual PRO con colores
// --------------------------------------------------------------
export default function ValidacionResultado({ data }) {
  if (!data) return null

  const info = data.data || {}

  // ---------------------------------------------
  // 1) Lógica de colores / tipo
  // ---------------------------------------------
  let color = '#6c757d'
  let bg = '#f8f9fa'
  let titulo = ''
  let icono = ''

  if (data.tipo === 'entrada') {
    const lote = (info.loteNombre || '').toLowerCase()
    const estado = info.estado || 'aprobada'

    if (estado !== 'aprobada') {
      // CANCELADA
      color = '#d9534f'
      bg = '#ffe5e5'
      titulo = 'ENTRADA CANCELADA'
      icono = '⛔'
    } else if (lote.includes('mujer')) {
      // MUJER
      color = '#e83e8c'
      bg = '#ffe6f2'
      titulo = 'ENTRADA MUJER'
      icono = '💖'
    } else if (lote.includes('hombre')) {
      // HOMBRE
      color = '#007bff'
      bg = '#e6f0ff'
      titulo = 'ENTRADA HOMBRE'
      icono = '💙'
    } else {
      // GENERAL
      color = '#28a745'
      bg = '#e6ffed'
      titulo = 'ENTRADA GENERAL'
      icono = '🎟️'
    }
  }

  if (data.tipo === 'compra') {
    if (info.estado === 'aprobada') {
      color = '#28a745'
      bg = '#e6ffed'
      titulo = 'COMPRA APROBADA'
      icono = '🛒✔️'
    } else {
      color = '#dc3545'
      bg = '#ffe5e5'
      titulo = 'COMPRA RECHAZADA'
      icono = '🛒❌'
    }
  }

  // ---------------------------------------------
  // 2) Estilos dinámicos
  // ---------------------------------------------
  const cardStyle = {
    border: `3px solid ${color}`,
    background: bg,
    padding: '16px',
    borderRadius: '12px',
    color: '#000',
  }

  const tituloStyle = {
    fontWeight: 'bold',
    fontSize: '1.4rem',
    color,
    marginBottom: '10px',
  }

  return (
    <div style={cardStyle} className="shadow-sm">
      <div style={tituloStyle}>
        {icono} {titulo}
      </div>

      <p style={{ marginBottom: 4 }}>
        <strong>Mensaje:</strong> {data.mensaje}
      </p>

      {data.tipo === 'entrada' && (
        <>
          <p>
            <strong>Evento:</strong> {info.nombreEvento}
          </p>
          <p>
            <strong>Usuario:</strong> {info.usuarioNombre}
          </p>
          <p>
            <strong>Lote:</strong> {info.loteNombre || 'General'}
          </p>
          <p>
            <strong>Usado:</strong> {info.usado ? 'Sí' : 'No'}
          </p>
        </>
      )}

      {data.tipo === 'compra' && (
        <>
          <p>
            <strong>Pedido:</strong> #{info.numeroPedido}
          </p>
          <p>
            <strong>Usuario:</strong> {info.usuarioNombre}
          </p>
          <p>
            <strong>Total:</strong> ${info.total}
          </p>
          <p>
            <strong>Estado:</strong> {info.estado}
          </p>
        </>
      )}

      {/* Debug opcional */}
      <pre
        className="mt-3 p-2 bg-dark text-success rounded"
        style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}
      >
        {JSON.stringify(info, null, 2)}
      </pre>
    </div>
  )
}
