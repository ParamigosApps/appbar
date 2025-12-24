import { limpiarPagosPendientes } from '../scripts/limpiarPagosPendientes.js'

export default async function handler(req, res) {
  const auth = req.headers.authorization

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  await limpiarPagosPendientes()
  return res.status(200).json({ ok: true })
}
