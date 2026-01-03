import { getAdmin } from './_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  const { paymentId } = req.query
  if (!paymentId) return res.status(400).json({ error: 'paymentId requerido' })

  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const admin = getAdmin()
  const db = admin.firestore()

  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
  )

  if (!r.ok) return res.status(500).json({ error: 'MP error' })

  const payment = await r.json()
  const pagoId = payment.external_reference

  if (!pagoId) return res.status(404).json({ error: 'sin external_reference' })

  await db
    .collection('pagos')
    .doc(pagoId)
    .update({
      estado: payment.status === 'approved' ? 'aprobado' : 'pendiente_mp',
      mpPaymentId: payment.id,
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

  return res.json({ ok: true, pagoId, status: payment.status })
}
