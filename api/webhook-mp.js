// /api/webhook-mp.js
import { waitUntil } from '@vercel/functions'
import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false }, // ⬅️ requerido por Mercado Pago
}

// ======================================================
// RAW BODY (leer UNA sola vez)
// ======================================================
function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
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

// ======================================================
// HANDLER
// ======================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end()

  // ⬅️ leer raw body ANTES
  const rawBody = await readRaw(req)

  // ✅ responder inmediato a MP
  res.status(200).json({ ok: true })

  // 🧠 trabajo real en background
  waitUntil(
    processEvent(rawBody).catch(err => console.error('[webhook-bg] error', err))
  )
}

// ======================================================
// BACKGROUND PROCESS
// ======================================================
async function processEvent(rawBody) {
  const reqId = `mp_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

  if (!MP_ACCESS_TOKEN) {
    console.error(`[${reqId}] MP_ACCESS_TOKEN faltante`)
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

  console.log(`[${reqId}] WEBHOOK`, { topic, paymentId })

  if (topic !== 'payment' || !paymentId) return

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  // ======================================================
  // IDEMPOTENCIA
  // ======================================================
  const eventKey = `payment_${paymentId}`
  const eventRef = db.collection('webhook_events').doc(eventKey)
  const eventSnap = await eventRef.get()

  if (eventSnap.exists && eventSnap.data()?.processed === true) {
    console.log(`[${reqId}] Evento ya procesado`)
    return
  }

  await eventRef.set(
    { paymentId, topic, receivedAt: now, processed: false },
    { merge: true }
  )

  // ======================================================
  // CONSULTAR PAYMENT (reintentos)
  // ======================================================
  let payment = null
  let lastStatus = null

  for (let i = 0; i < 5; i++) {
    const r = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
    )

    lastStatus = r.status
    if (r.ok) {
      payment = await r.json()
      break
    }

    await sleep(800 * (i + 1))
  }

  if (!payment) {
    await eventRef.set(
      { last_error: lastStatus, updatedAt: now },
      { merge: true }
    )
    return
  }

  const pagoId = payment.external_reference
  if (!pagoId) {
    await eventRef.set(
      { note: 'sin_external_reference', updatedAt: now },
      { merge: true }
    )
    return
  }

  const pagoRef = db.collection('pagos').doc(pagoId)
  const snap = await pagoRef.get()

  if (!snap.exists) {
    await eventRef.set(
      { note: 'pago_no_encontrado', updatedAt: now },
      { merge: true }
    )
    return
  }

  const pago = snap.data()

  // ======================================================
  // VALIDAR MONTO
  // ======================================================
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

  // ======================================================
  // ESTADOS
  // ======================================================
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
          : 'pendiente',
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      mpPaymentId: payment.id,
      updatedAt: now,
    })
  }

  // ======================================================
  // FINAL
  // ======================================================
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

  console.log(`[${reqId}] WEBHOOK OK`)
}
