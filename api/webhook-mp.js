// /api/webhook-mp.js
import { waitUntil } from '@vercel/functions'
import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false }, // ⬅️ CLAVE
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
// HANDLER
// ======================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end()
  }

  // ⬅️ RESPUESTA INMEDIATA A MP (OBLIGATORIO)
  res.status(200).json({ ok: true })

  // ⬅️ PROCESO ASÍNCRONO REAL
  waitUntil(processEvent(req))
}

// ======================================================
// BACKGROUND PROCESS
// ======================================================
async function processEvent(req) {
  const reqId = `mp_${Date.now()}`
  try {
    const raw = await readRaw(req)
    const body = JSON.parse(raw || '{}')

    const paymentId = body?.data?.id
    const topic = body.type || body.topic

    if (topic !== 'payment' || !paymentId) return

    const admin = getAdmin()
    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    // --------------------------------------------------
    // IDMPOTENCIA
    // --------------------------------------------------
    const eventKey = `payment_${paymentId}`
    const eventRef = db.collection('webhook_events').doc(eventKey)
    const eventSnap = await eventRef.get()

    if (eventSnap.exists && eventSnap.data()?.processed) {
      return
    }

    await eventRef.set(
      { receivedAt: now, paymentId, processed: false },
      { merge: true }
    )

    // --------------------------------------------------
    // CONSULTAR PAYMENT REAL
    // --------------------------------------------------
    const token = process.env.MP_ACCESS_TOKEN
    let payment = null

    for (let i = 0; i < 5; i++) {
      const r = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (r.ok) {
        payment = await r.json()
        break
      }
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }

    if (!payment) return

    const pagoId = payment.external_reference
    if (!pagoId) return

    const pagoRef = db.collection('pagos').doc(pagoId)
    const snap = await pagoRef.get()
    if (!snap.exists) return

    const pago = snap.data()

    // --------------------------------------------------
    // VALIDAR MONTO EN CENTAVOS
    // --------------------------------------------------
    const mpCents = Math.round(Number(payment.transaction_amount) * 100)
    const fsCents = Math.round(Number(pago.total) * 100)

    if (mpCents !== fsCents) {
      await pagoRef.update({
        estado: 'monto_invalido',
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        mpPaymentId: payment.id,
        updatedAt: now,
      })
      return
    }

    // --------------------------------------------------
    // ESTADOS
    // --------------------------------------------------
    if (payment.status === 'approved') {
      if (pago.estado !== 'aprobado') {
        await pagoRef.update({
          estado: 'aprobado',
          approvedAt: now,
          mpStatus: payment.status,
          mpDetail: payment.status_detail,
          mpPaymentId: payment.id,
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

    await eventRef.set(
      { processed: true, payment_status: payment.status, updatedAt: now },
      { merge: true }
    )
  } catch (err) {
    console.error('[webhook-mp] ERROR', err)
  }
}
