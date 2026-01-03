// /api/webhook-mp.js
import { waitUntil } from '@vercel/functions'
import crypto from 'crypto'
import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false },
}

// ======================================================
// RAW BODY
// ======================================================
function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// ======================================================
// UTILS
// ======================================================
const cents = v =>
  Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN

const sleep = ms => new Promise(r => setTimeout(r, ms))

function verifySignature(req, raw, secret) {
  if (!secret) return true
  const sig = req.headers['x-signature']
  if (!sig) return false
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return sig === hmac
}

// ======================================================
// HANDLER
// ======================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end()

  const rawBody = await readRaw(req)

  res.status(200).json({ ok: true })

  waitUntil(
    processEvent(req, rawBody).catch(err =>
      console.error('[webhook-bg] error', err)
    )
  )
}

// ======================================================
// BACKGROUND
// ======================================================
async function processEvent(req, rawBody) {
  const reqId = `mp_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
  const MP_COLLECTOR_ID = Number(process.env.MP_COLLECTOR_ID)

  if (!MP_ACCESS_TOKEN) return

  if (!verifySignature(req, rawBody, MP_WEBHOOK_SECRET)) {
    console.error(`[${reqId}] Firma inválida`)
    return
  }

  let body
  try {
    body = JSON.parse(rawBody || '{}')
  } catch {
    console.error(`[${reqId}] JSON inválido`)
    return
  }

  const topic = body.type || body.topic
  const paymentId = body?.data?.id
  if (topic !== 'payment' || !paymentId) return

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  const eventKey = `payment_${paymentId}`
  const eventRef = db.collection('webhook_events').doc(eventKey)

  await db
    .runTransaction(async tx => {
      const snap = await tx.get(eventRef)
      if (snap.exists && snap.data()?.processed) throw new Error('already')
      tx.set(
        eventRef,
        { paymentId, topic, receivedAt: now, processed: false },
        { merge: true }
      )
    })
    .catch(() => {
      return
    })

  let payment = null
  let lastError = null

  for (let i = 0; i < 5; i++) {
    try {
      const ac = new AbortController()
      setTimeout(() => ac.abort(), 8000)

      const r = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
          signal: ac.signal,
        }
      )

      lastError = r.status

      if (r.ok) {
        payment = await r.json()
        break
      }
    } catch (e) {
      lastError = e.message
    }

    await sleep(800 * (i + 1))
  }

  if (!payment) {
    await eventRef.set(
      { last_error: lastError, updatedAt: now },
      { merge: true }
    )
    return
  }

  if (payment.live_mode !== true) return
  if (MP_COLLECTOR_ID && payment.collector_id !== MP_COLLECTOR_ID) return

  const pagoId = payment.external_reference
  if (!pagoId) return

  const pagoRef = db.collection('pagos').doc(pagoId)
  const snap = await pagoRef.get()
  if (!snap.exists) return

  const pago = snap.data()

  if (cents(payment.transaction_amount) !== cents(pago.total)) {
    await pagoRef.update({
      estado: 'monto_invalido',
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      mpPaymentId: payment.id,
      updatedAt: now,
    })
    return
  }

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
    {
      processed: true,
      payment_status: payment.status,
      collector_id: payment.collector_id,
      live_mode: payment.live_mode,
      processedAt: now,
    },
    { merge: true }
  )
}
