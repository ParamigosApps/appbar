export function renderEventoHtml(evento) {
  if (!evento) return ''

  const fecha = evento.fechaInicio?.seconds
    ? new Date(evento.fechaInicio.seconds * 1000)
    : evento.fechaInicio
    ? new Date(evento.fechaInicio)
    : null

  if (!fecha) return ''

  const hoy = new Date()
  const esHoy = fecha.toDateString() === hoy.toDateString()

  const fechaTexto = fecha
    .toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    .toUpperCase()

  return `
    <div style="
      text-align:center;
      margin-bottom:10px;
      font-size:17px;
      font-weight:800;
      letter-spacing:0.4px;
      color:#0f172a;
    ">
      🎟 ${esHoy ? 'HOY – ' : ''}${fechaTexto} – ${evento.nombre.toUpperCase()}
    </div>

    <div style="
      margin-top:6px;
      padding:6px 10px;
      background:#fff7ed;
      border-left:3px solid #f59e0b;
      border-radius:4px;
      font-size:12px;
      color:#92400e;
      text-align:center;
    ">
      ⚠️ Verificá que sea el evento correcto antes de continuar.
    </div>
  `
}

export function formatearEventoLinea(evento) {
  if (!evento?.fechaInicio) return evento?.nombre || ''

  const fecha = evento.fechaInicio.seconds
    ? new Date(evento.fechaInicio.seconds * 1000)
    : new Date(evento.fechaInicio)

  const hoy = new Date()
  const esHoy = fecha.toDateString() === hoy.toDateString()

  const fechaTexto = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return `${
    esHoy ? 'HOY – ' : ''
  }${fechaTexto.toUpperCase()} – ${evento.nombre.toUpperCase()}`
}
