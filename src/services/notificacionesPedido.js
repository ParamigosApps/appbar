// src/services/notificacionesPedido.js
import { enviarMail } from './mailService'
import { mailPedido } from './mailTemplates'

export async function notificarPedidoCreado({ email, nombre, pedido }) {
  if (!email || !pedido) return

  // 🛡️ Normalización defensiva
  const {
    numeroPedido = '—',
    total = '—',
    lugar = '—',
    fecha = pedido.fechaHumana ?? new Date(),
  } = pedido

  const nombreFinal = nombre || 'Cliente'

  try {
    await enviarMail({
      to: email,
      subject: `🧾 Pedido #${numeroPedido} | AppBar`,
      html: mailPedido({
        nombre: nombreFinal,
        numeroPedido,
        total,
        lugar,
        fecha,
      }),
    })
  } catch (err) {
    console.warn('⚠️ Mail pedido no enviado:', err)
  }
}
