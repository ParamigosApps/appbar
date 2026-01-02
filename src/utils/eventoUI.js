export function renderEventoHtml(evento) {
  if (!evento?.fechaInicio) return ''

  // -----------------------------
  // Normalizar fecha
  // -----------------------------
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

  // -----------------------------
  // Hora
  // -----------------------------
  const horaTexto = evento.horaInicio
    ? evento.horaInicio
    : fecha.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })

  // -----------------------------
  // HTML final
  // -----------------------------
  return `
    <div style="
      text-align:center;
      margin-bottom:10px;
      font-size:18px;
      font-weight:800;
      letter-spacing:0.4px;
      color:#0f172a;
    ">
      🎟️ ${esHoy ? '<strong >HOY</strong> – ' : ''}
      ${fechaTexto.toUpperCase()}
    </div>

    <div style="
      text-align:center;
      font-size:16px;
      margin-bottom:8px;
      color:#020617;
    ">
      ⏰ <strong>${horaTexto} HS</strong>
    </div>

    <div style="
      text-align:center;
      font-size:17px;
      font-weight:800;
      margin-bottom:12px;
    ">
      ${evento.nombre.toUpperCase()}
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
function calcularArrancaEn(fecha) {
  const ahora = new Date()
  const diffMs = fecha - ahora

  if (diffMs <= 0) return null

  const minutos = Math.floor(diffMs / 60000)

  if (minutos < 60) {
    return `ARRANCA EN ${minutos} MIN`
  }

  const horas = Math.floor(minutos / 60)
  return `ARRANCA EN ${horas} HS`
}

export function formatearEventoLinea(evento) {
  if (!evento?.fechaInicio) return evento?.nombre || ''

  // -----------------------------
  // Fecha
  // -----------------------------
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

  // -----------------------------
  // Hora
  // -----------------------------
  const horaTexto = evento.horaInicio
    ? evento.horaInicio
    : fecha.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })

  // -----------------------------
  // Arranca en...
  // -----------------------------
  const arrancaEn = esHoy ? calcularArrancaEn(fecha) : null

  // -----------------------------
  // HTML final
  // -----------------------------
  return `
    ${esHoy ? '<strong >HOY</strong> – ' : ''}
    ${fechaTexto.toUpperCase()} • 
    <strong>${horaTexto} HS</strong> – 
    <strong>${evento.nombre.toUpperCase()}</strong>
    ${
      arrancaEn
        ? `<span style="
            display:inline-block;
            margin-left:6px;
            padding:2px 6px;
            font-size:11px;
            border-radius:6px;
            background:#dcfce7;
            color:#166534;
            font-weight:700;
          ">
            ${arrancaEn}
          </span>`
        : ''
    }
  `
}
