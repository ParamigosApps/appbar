import crypto from 'crypto'
import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false },
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

const cents = v => Math.round(Number(v) * 100)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end()

  const rawBody = await readRaw(req)

  // RESPUESTA INMEDIATA A MP
  res.status(200).json({ ok: true })

  // NO await
  processEvent(req, rawBody).catch(e => console.error('[webhook-bg]', e))
}

async function processEvent(req, rawBody) {
  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  const { MP_ACCESS_TOKEN, MP_COLLECTOR_ID } = process.env
  if (!MP_ACCESS_TOKEN) return

  let body
  try {
    body = JSON.parse(rawBody || '{}')
  } catch {
    return
  }

  const paymentId = body?.data?.id
  if (!paymentId) return

  const eventRef = db.collection('webhook_events').doc(`payment_${paymentId}`)

  let pagoId = null

  // consultar pago
  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
  )

  if (!r.ok) {
    await eventRef.set({ error: r.status, updatedAt: now }, { merge: true })
    return
  }

  const payment = await r.json()
  pagoId = payment.external_reference

  if (!pagoId) return

  const pagoRef = db.collection('pagos').doc(pagoId)
  const snap = await pagoRef.get()

  if (!snap.exists) {
    await pagoRef.set(
      { estado: 'pendiente_mp', updatedAt: now },
      { merge: true }
    )
    return
  }

  const pago = snap.data()

  // validar collector
  if (MP_COLLECTOR_ID && payment.collector_id !== Number(MP_COLLECTOR_ID)) {
    await pagoRef.update({ estado: 'pendiente_mp', updatedAt: now })
    return
  }

  // validar monto
  if (cents(payment.transaction_amount) !== cents(pago.total)) {
    await pagoRef.update({ estado: 'monto_invalido', updatedAt: now })
    return
  }

  // estado final
  if (payment.status === 'approved') {
    if (pago.estado !== 'aprobado') {
      await pagoRef.update({
        estado: 'aprobado',
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        mpPaymentId: payment.id,
        approvedAt: now,
        updatedAt: now,
      })

      await generarEntradasPagasDesdePago(pagoId, pago)
    }
  } else {
    await pagoRef.update({
      estado:
        payment.status === 'rejected' || payment.status === 'cancelled'
          ? 'rechazado'
          : 'pendiente_mp',
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      mpPaymentId: payment.id,
      updatedAt: now,
    })
  }

  await eventRef.set(
    { processed: true, payment_status: payment.status, updatedAt: now },
    { merge: true }
  )
}
