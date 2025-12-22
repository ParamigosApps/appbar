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

  const fechaStr =
    fecha instanceof Date ? fecha.toLocaleString('es-AR') : String(fecha)

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#333">

      <h2 style="margin-bottom:6px">👋 Registro exitoso en AppBar</h2>

      <p style="margin-top:0;color:#555">
        Tu cuenta fue creada correctamente. Ya podés ingresar y operar en AppBar.
      </p>

      <hr/>

      <p><b>Nombre:</b> ${nombre || 'Usuario'}</p>
      <p><b>Método de registro:</b> ${metodo}</p>

      ${email ? `<p><b>Email:</b> ${email}</p>` : ''}
      ${telefono ? `<p><b>Teléfono:</b> ${telefono}</p>` : ''}

      <p><b>Fecha de alta:</b> ${fechaStr}</p>

      <hr/>

      <p style="font-size:13px;color:#555">
        Este correo se envía únicamente al momento de crear tu cuenta.
        Si no realizaste este registro, podés ignorar este mensaje.
      </p>

      <p style="font-size:12px;color:#777;margin-top:12px">
        ID de usuario: ${uid || '—'}
      </p>

      <p style="font-size:12px;color:#999;margin-top:16px;text-align:center">
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

  const nombre = payload.nombre ?? pedido.usuarioNombre ?? 'Cliente'
  const numeroPedido = pedido.numeroPedido ?? pedido.id ?? '—'
  const total = pedido.total ?? '—'
  const lugar = pedido.lugar ?? '—'
  const fecha = payload.fecha ?? new Date()
  const qrUrl = payload.qrUrl ?? pedido.qrUrl
  const eventoNombre = payload.eventoNombre ?? pedido.eventoNombre ?? null

  const ticketId = payload.ticketId ?? pedido.ticketId ?? pedido.id ?? '—'

  const fechaStr =
    fecha instanceof Date ? fecha.toLocaleString('es-AR') : String(fecha)

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#333">

      <h2 style="margin-bottom:6px">🧾 Pedido confirmado</h2>

      <p>
        Hola <b>${nombre}</b>, tu pedido fue confirmado correctamente.
      </p>

      <hr/>

      <p><b>Pedido:</b> #${numeroPedido}</p>
      ${eventoNombre ? `<p><b>Evento:</b> ${eventoNombre}</p>` : ''}
      <p><b>Total:</b> $${total}</p>
      <p><b>Lugar:</b> ${lugar}</p>
      <p><b>Fecha:</b> ${fechaStr}</p>

      <hr/>
      <p><b>Código de retiro:</b>
        <span style="
          font-size:16px;
          font-weight:bold;
          letter-spacing:0.5px;
        ">
          ${ticketId}
        </span>
      </p>

      ${
        qrUrl
          ? `
          <div style="text-align:center;margin:15px 0">
            <img
              src="${qrUrl}"
              alt="Código QR del pedido"
              style="width:220px;height:auto;display:block;margin:auto"
            />
            <p style="font-size:13px;color:#555;margin-top:8px">
              Presentá este QR en caja para retirar tu compra.
            </p>
          </div>
        `
          : `
          <p style="color:#c00;text-align:center">
            El código QR no está disponible en este momento. 
            Presentá el código en caja.
          </p>
        `
      }

      <hr/>

      <p style="font-size:13px;color:#555;line-height:1.4">
        <b>Importante:</b> este ticket es válido <b>únicamente para el evento
        o compra correspondiente a este pedido</b>.
        No puede utilizarse en otros eventos, fechas o locales.
      </p>

      <p style="font-size:12px;color:#999;margin-top:24px;text-align:center">
        AppBar 🍻 — Sistema de pedidos
      </p>

    </div>
  `
}

export function mailEntradas({ nombre, evento, entradas = [], qrs = [] }) {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f7f7f7; padding:20px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" style="background:#ffffff; padding:20px; border-radius:8px">
            <tr>
              <td>

                <h2 style="margin-top:0">
                  Hola ${nombre || 'Usuario'}
                </h2>

                <p>
                  Estas son tus entradas para
                  <strong>${evento?.nombre || 'el evento'}</strong>
                </p>

                ${entradas
                  .map((_, i) => {
                    const qr = qrs[i]
                    if (!qr) return ''

                    return `
                      <div style="margin:20px 0; text-align:center">
                        <p><strong>Entrada #${i + 1}</strong></p>
                    <img
                      src="${qr}"
                      alt="Entrada-${i + 1}"
                      title="Entrada-${i + 1}"
                      width="200"
                      style="border:1px solid #ddd; padding:10px"
                    />
                      </div>
                    `
                  })
                  .join('')}

                <p style="margin-top:30px; font-size:14px; color:#555">
                  Podés acceder a tus QR directamente desde la app.
                </p>

              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}
