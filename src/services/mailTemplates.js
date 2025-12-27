import { formatearFecha } from '../utils/utils.js'

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

// --------------------------------------------------------------
// MAIL — ENTRADAS APROBADAS (FINAL)
// --------------------------------------------------------------
export function mailEntradasAprobadas({
  usuarioNombre = 'Usuario',
  eventoNombre = 'Evento',
  fechaEvento = null,
  lugar = '',
  horarioEvento = '',
  resumenLotes = [],
  qrs = [],
  metodo = 'Mercado Pago',
}) {
  const fechaStr = formatearFecha(fechaEvento)

  return `
  <div style="
    font-family: Arial, sans-serif;
    max-width: 560px;
    margin: auto;
    color: #222;
    background: #ffffff;
    border-radius: 10px;
    padding: 24px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.08)
  ">

    <!-- HEADER -->
    <div style="text-align:center;margin-bottom:20px">
      <h2 style="margin:0">🎟️ Entradas confirmadas</h2>
      <p style="margin:6px 0 0;color:#555">
        Tu compra fue procesada correctamente
      </p>
    </div>

    <!-- SALUDO -->
    <p>
      Hola <b>${usuarioNombre}</b>,<br/>
      estas son tus entradas válidas para el siguiente evento:
    </p>

    <!-- EVENTO -->
    <div style="
      border:1px solid #e5e7eb;
      border-radius:8px;
      padding:14px;
      margin:16px 0;
      background:#fafafa
    ">
      <p style="margin:4px 0"><b>📍 Evento:</b> ${eventoNombre}</p>
      <p style="margin:4px 0"><b>📅 Fecha:</b> ${fechaStr}</p>
      ${
        horarioEvento
          ? `<p style="margin:4px 0"><b>⏰ Horario:</b> ${horarioEvento}</p>`
          : ''
      }
      ${lugar ? `<p style="margin:4px 0"><b>📌 Lugar:</b> ${lugar}</p>` : ''}
    </div>

    <!-- LOTES -->
    <h3 style="margin-top:24px">🎫 Detalle de entradas</h3>

    <ul style="padding-left:18px;margin-top:10px">
      ${resumenLotes
        .map(
          lote => `
        <li style="margin-bottom:12px">
          <b>${lote.cantidad} × ${lote.nombre}</b>
          ${
            lote.horarioIngreso
              ? `<br/>
                <span style="font-size:13px;color:#555">
                  🚪 Horario de ingreso: ${lote.horarioIngreso}
                </span>`
              : ''
          }
        </li>
      `
        )
        .join('')}
    </ul>

    <!-- QRS -->
    ${
      qrs.length
        ? `
      <hr style="margin:24px 0"/>

      <h3>Códigos QR</h3>

      <p style="font-size:14px;color:#555">
        Presentá el código QR correspondiente en el ingreso del evento.
      </p>

      ${qrs
        .map(
          (item, i) => `
        <div style="
          text-align:center;
          margin:20px 0;
          padding:16px;
          border:1px dashed #ddd;
          border-radius:8px
        ">
          <p style="margin-bottom:8px">
            <b>Entrada #${i + 1}</b>
          </p>

          ${
            item.url
              ? `<img
                  src="${item.url}"
                  width="200"
                  style="border:1px solid #ddd;padding:8px;background:#fff"
                />`
              : ''
          }

          <p style="
            font-size:12px;
            color:#666;
            margin-top:8px;
            word-break:break-all
          ">
            ID de entrada:<br/>
            <b>${item.id}</b>
          </p>
        </div>
      `
        )
        .join('')}
    `
        : ''
    }

    <div style="text-align:center;margin-top:12px">
  <a
    href="https://app-para-bares.vercel.app/mis-entradas"
    target="_blank"
    style="
      display:inline-block;
      padding:12px 18px;
      background:#0d6efd;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
      font-size:14px;
      font-weight:600;
    "
  >
    Ir a Mis Entradas
  </a>

  <p style="margin:6px 0 0;font-size:12px;color:#666">
    Desde allí podés ver y descargar tus códigos QR
  </p>
</div>

    <!-- FOOTER INFO -->
    <hr style="margin:24px 0"/>

    <p style="font-size:14px">
      <b>Método de pago:</b> ${metodo}<br/>
      <b>Estado:</b>
      <span style="color:#0a7;font-weight:bold">PAGO CONFIRMADO</span>
    </p>

    <p style="font-size:13px;color:#555;line-height:1.4">
      Estas entradas son <b>válidas únicamente para el evento indicado</b>.
      No son transferibles ni reutilizables en otras fechas o locales.
    </p>

    <p style="font-size:12px;color:#888;margin-top:14px">
      Si tenés problemas para visualizar los QR, podés acceder a ellos
      desde la sección <b>Mis Entradas</b> en la app.
    </p>

    <p style="
      font-size:12px;
      color:#aaa;
      margin-top:24px;
      text-align:center
    ">
      AppBar 🍻 — Plataforma de eventos
    </p>

  </div>
  `
}
