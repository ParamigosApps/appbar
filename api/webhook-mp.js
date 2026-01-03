// /api/webhook-mp.js
import { waitUntil } from '@vercel/functions'
import { getAdmin } from './_lib/firebaseAdmin.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false }, // ⬅️ CLAVE PARA MERCADO PAGO
}

// ======================================================
// RAW BODY
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
function cents(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ======================================================
// HANDLER
// ======================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end()
  }

  // ✅ RESPUESTA INMEDIATA A MERCADO PAGO
  res.status(200).json({ ok: true })

  // 🧠 PROCESAMIENTO EN SEGUNDO PLANO
  waitUntil(
    processEvent(req).catch(err => console.error('[webhook-bg] error', err))
  )
}

// ======================================================
// BACKGROUND WORK
// ======================================================
async function processEvent(req) {
  const reqId = `mp_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

  if (!MP_ACCESS_TOKEN) {
    console.error(`[${reqId}] MP_ACCESS_TOKEN faltante`)
    return
  }

  const raw = await readRaw(req)
  const body = JSON.parse(raw || '{}')

  const topic = body.type || body.topic
  const paymentId = body?.data?.id

  console.log(`[${reqId}] WEBHOOK RECIBIDO`, { topic, paymentId })

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
    {
      topic,
      paymentId,
      receivedAt: now,
      processed: false,
    },
    { merge: true }
  )

  // ======================================================
  // CONSULTAR PAYMENT (REINTENTOS)
  // ======================================================
  let payment = null
  let lastError = null

  for (let i = 0; i < 5; i++) {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )

    lastError = res.status

    if (res.ok) {
      payment = await res.json()
      break
    }

    await sleep(800 * (i + 1))
  }

  if (!payment) {
    console.error(`[${reqId}] No se pudo obtener payment`, lastError)
    await eventRef.set(
      { last_error: lastError, updatedAt: now },
      { merge: true }
    )
    return
  }

  console.log(`[${reqId}] PAYMENT`, {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    collector_id: payment.collector_id,
    live_mode: payment.live_mode,
    external_reference: payment.external_reference,
  })

  // ======================================================
  // VALIDAR EXTERNAL_REFERENCE
  // ======================================================
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
  // VALIDAR MONTO (CENTAVOS)
  // ======================================================
  const mpCents = cents(payment.transaction_amount)
  const fsCents = cents(pago.total)

  if (!Number.isFinite(mpCents) || mpCents !== fsCents) {
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

      // 🎟️ GENERAR ENTRADAS
      await import('./_lib/generarEntradasPagasDesdePago.js').then(m =>
        m.generarEntradasPagasDesdePago(pagoId, pago)
      )
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
  // MARCAR EVENTO PROCESADO
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
