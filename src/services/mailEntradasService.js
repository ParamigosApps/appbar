import { enviarMail } from './mailService'
import { mailEntradas } from './mailTemplates'
import { generarYSubirQrEntrada } from './qrStorageService'

export async function enviarEntradasPorMail({
  email,
  nombre,
  evento,
  entradas = [], // [{ id, qr }]
}) {
  if (!email || entradas.length === 0) return

  const qrs = await Promise.all(
    entradas.map(e =>
      generarYSubirQrEntrada({
        payload: e.qr,
        entradaId: e.id,
      })
    )
  )

  await enviarMail({
    to: email,
    subject: `🎟️ Tus entradas para ${evento.nombre}`,
    html: mailEntradas({
      nombre: nombre || 'Usuario',
      evento,
      entradas,
      qrs, // URLs HTTPS
    }),
  })
}
