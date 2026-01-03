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

const cents = v =>
  Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN

const sleep = ms => new Promise(r => setTimeout(r, ms))

function verifySignature(req, raw, secret) {
  if (!secret) return true

  const signature = req.headers['x-signature']
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex')

  return signature === hmac
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end()

  const rawBody = await readRaw(req)

  // responder inmediato a MP
  res.status(200).json({ ok: true })

  // procesar normalmente (Node NO corta acá)
  processEvent(rawBody).catch(err => console.error('[webhook] error', err))
}

async function processEvent(req, rawBody) {
  const reqId = `mp_${Date.now()}_${Math.random().toString(16).slice(2)}`

  const { MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_COLLECTOR_ID } = process.env

  if (!MP_ACCESS_TOKEN) {
    console.error(`[${reqId}] MP_ACCESS_TOKEN faltante`)
    return
  }

  if (!verifySignature(req, rawBody, MP_WEBHOOK_SECRET)) {
    console.error(`[${reqId}] Firma inválida`, {
      signature: req.headers['x-signature'],
    })
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
  const action = body.action || null
  const paymentId = body?.data?.id

  if (topic !== 'payment' || !paymentId) return

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  const eventKey = `payment_${paymentId}`
  const eventRef = db.collection('webhook_events').doc(eventKey)

  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(eventRef)
      if (snap.exists && snap.data()?.processed) {
        tx.set(
          eventRef,
          {
            note: 'already_processed',
            updatedAt: now,
          },
          { merge: true }
        )
        throw new Error('already')
      }

      tx.set(
        eventRef,
        {
          paymentId,
          topic,
          action,
          x_request_id: req.headers['x-request-id'] || null,
          x_signature: req.headers['x-signature'] || null,
          receivedAt: now,
          processed: false,
        },
        { merge: true }
      )
    })
  } catch {
    return
  }

  let payment = null
  let lastError = null
  let lastErrorText = null

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
      } else {
        lastErrorText = await r.text()
      }
    } catch (e) {
      lastError = e.message
      lastErrorText = String(e)
    }

    await sleep(800 * (i + 1))
  }

  if (!payment) {
    await eventRef.set(
      {
        last_error: lastError,
        last_error_text: lastErrorText,
        updatedAt: now,
      },
      { merge: true }
    )
    return
  }

  if (payment.live_mode !== true) return
  if (MP_COLLECTOR_ID && payment.collector_id !== Number(MP_COLLECTOR_ID))
    return

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
        refunded_cents: payment.transaction_amount_refunded
          ? cents(payment.transaction_amount_refunded)
          : 0,
        updatedAt: now,
      })

      await generarEntradasPagasDesdePago(pagoId, pago)
    }
  } else {
    const isRefunded =
      payment.status === 'refunded' ||
      payment.status_detail?.startsWith('partially_refunded')

    const isChargeback =
      payment.status === 'charged_back' ||
      payment.status_detail?.includes('chargeback')

    let estado

    if (isChargeback) estado = 'reversado'
    else if (isRefunded) estado = 'reembolsado'
    else if (payment.status === 'rejected' || payment.status === 'cancelled')
      estado = 'rechazado'
    else estado = 'pendiente_mp'

    const refundedCents = Array.isArray(payment.refunds)
      ? Math.round(
          payment.refunds.reduce((acc, r) => acc + Number(r.amount || 0), 0) *
            100
        )
      : payment.transaction_amount_refunded
      ? cents(payment.transaction_amount_refunded)
      : 0

    await pagoRef.update({
      estado,
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      mpPaymentId: payment.id,
      refunded_cents: refundedCents,
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
