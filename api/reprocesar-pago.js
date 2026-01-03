import { getAdmin } from './_lib/firebaseAdmin.js'

export default async function handler(req, res) {
  const { paymentId } = req.query
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId requerido' })
  }

  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN faltante' })
  }

  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
  )

  if (!r.ok) {
    return res.status(500).json({ error: 'Error consultando MP' })
  }

  const payment = await r.json()
  const pagoId = payment.external_reference

  if (!pagoId) {
    return res.status(404).json({ error: 'Sin external_reference' })
  }

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  let estado = 'pendiente_mp'

  if (payment.status === 'rejected' || payment.status === 'cancelled') {
    estado = 'rechazado'
  }

  if (
    payment.status === 'refunded' ||
    payment.status_detail?.startsWith('partially_refunded')
  ) {
    estado = 'reembolsado'
  }

  if (
    payment.status === 'charged_back' ||
    payment.status_detail?.includes('chargeback')
  ) {
    estado = 'reversado'
  }

  if (payment.status === 'approved') {
    estado = 'aprobado'
  }

  await db.collection('pagos').doc(pagoId).update({
    estado,
    mpPaymentId: payment.id,
    mpStatus: payment.status,
    mpDetail: payment.status_detail,
    updatedAt: now,
  })

  return res.json({
    ok: true,
    pagoId,
    estado,
    mpStatus: payment.status,
  })
}
