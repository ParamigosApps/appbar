// --------------------------------------------------------------
// LOGIN — TEMPLATE FINAL MULTI PROVIDER
// --------------------------------------------------------------
export function mailLogin({
  nombre,
  provider,
  email,
  telefono,
  uid,
  fecha = new Date(),
}) {
  const metodoMap = {
    google: 'Google',
    facebook: 'Facebook',
    phone: 'Teléfono',
  }

  const metodo = metodoMap[provider] || provider || 'Desconocido'

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;color:#333">

      <h2 style="margin-bottom:6px">
        👋 Registro exitoso en AppBar
      </h2>

      <p style="margin-top:0;color:#555">
        Tu cuenta fue creada correctamente. Ya podés ingresar y operar en AppBar.
      </p>

      <hr/>

      <p><b>Nombre:</b> ${nombre || 'Usuario'}</p>
      <p><b>Método de registro:</b> ${metodo}</p>

      ${email ? `<p><b>Email:</b> ${email}</p>` : ''}
      ${telefono ? `<p><b>Teléfono:</b> ${telefono}</p>` : ''}

      <p><b>Fecha de alta:</b> ${
        fecha instanceof Date ? fecha.toLocaleString() : fecha
      }</p>

      <hr/>

      <p style="font-size:13px;color:#555">
        ⚠️ Este correo se envía solo la primera vez que se crea tu cuenta.
        Si no realizaste este registro, podés ignorar este mensaje.
      </p>

      <p style="font-size:12px;color:#777;margin-top:12px">
        ID de usuario: ${uid || '—'}
      </p>

      <p style="font-size:12px;color:#999;margin-top:16px">
        AppBar 🍻 — Plataforma de eventos y compras
      </p>

    </div>
  `
}

// --------------------------------------------------------------
// MAIL — PEDIDO CONFIRMADO (SOLO PAGADOS)
// --------------------------------------------------------------
export function mailPedido(payload = {}) {
  const pedido = payload.pedido ?? payload

  const nombre = payload.nombre ?? pedido.nombre ?? 'Cliente'
  const numeroPedido = pedido.numeroPedido ?? pedido.id ?? '—'
  const total = pedido.total ?? '—'
  const lugar = pedido.lugar ?? '—'
  const fecha = pedido.fecha ?? new Date()

  const fechaStr =
    fecha instanceof Date ? fecha.toLocaleString('es-AR') : String(fecha)

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;color:#333">
      <h2>🧾 Pedido confirmado</h2>

      <p>
        Hola <b>${nombre}</b>, tu pedido fue confirmado correctamente.
      </p>

      <hr/>

      <p><b>Pedido:</b> #${numeroPedido}</p>
      <p><b>Total:</b> $${total}</p>
      <p><b>Lugar:</b> ${lugar}</p>
      <p><b>Fecha:</b> ${fechaStr}</p>

      <hr/>

      <p style="font-size:13px;color:#555">
        Presentá este comprobante en caja o al retirar tu compra.
      </p>

      <p style="font-size:12px;color:#999;margin-top:16px">
        AppBar 🍻 — Sistema de pedidos
      </p>
    </div>
  `
}
