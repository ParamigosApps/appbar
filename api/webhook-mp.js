// /api/webhook-mp.js
export const config = {
  runtime: 'nodejs',
  api: { bodyParser: true },
}

import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

// ======================================================
// UTILS
// ======================================================
function safeStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function asNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function cents(v) {
  const n = asNumber(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

async function safeReadBody(req) {
  const b = req.body
  if (!b) return {}
  if (typeof b === 'object') return b
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return { _raw: b }
    }
  }
  return {}
}

// ======================================================
// HANDLER
// ======================================================
export default async function handler(req, res) {
  const reqId = `wh_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const t0 = Date.now()

  console.log(`🚀 [${reqId}] WEBHOOK START`)

  if (req.method !== 'POST') {
    console.log(`ℹ️ [${reqId}] Método ignorado`, req.method)
    return res.status(200).send('only POST')
  }

  try {
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
    if (!MP_ACCESS_TOKEN) {
      console.error(`❌ [${reqId}] MP_ACCESS_TOKEN faltante`)
      return res.status(200).send('env error')
    }

    const admin = getAdmin()
    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const body = await safeReadBody(req)

    // --------------------------------------------------
    // INPUT
    // --------------------------------------------------
    const topic =
      safeStr(body.type) || safeStr(body.topic) || safeStr(req.query.topic)
    const action = safeStr(body.action) || safeStr(req.query.action)

    const rawPaymentId =
      safeStr(body?.data?.id) ||
      safeStr(req.query.id) ||
      safeStr(req.query['data.id']) ||
      safeStr(req.query['data[id]'])

    console.log(`📩 [${reqId}] INPUT`, {
      topic,
      action,
      rawPaymentId,
      query: req.query,
      body,
    })

    // --------------------------------------------------
    // RESOLVER PAYMENT ID
    // --------------------------------------------------
    let resolvedPaymentId = rawPaymentId

    if (topic === 'merchant_order') {
      console.log(`🔁 [${reqId}] Resolviendo merchant_order`, rawPaymentId)

      if (!rawPaymentId) {
        console.warn(`⚠️ [${reqId}] merchant_order sin id`)
        return res.status(200).send('ignored')
      }

      const moUrl = `https://api.mercadopago.com/merchant_orders/${rawPaymentId}`
      const moRes = await fetch(moUrl, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })

      if (!moRes.ok) {
        console.error(`❌ [${reqId}] merchant_order fetch error`)
        return res.status(200).send('ignored')
      }

      const mo = await moRes.json()
      const payments = Array.isArray(mo.payments) ? mo.payments : []

      console.log(`📦 [${reqId}] merchant_order payments`, payments)

      const approved = payments.find(p => p.status === 'approved')
      const last = payments[payments.length - 1]

      resolvedPaymentId = safeStr(approved?.id || last?.id)

      console.log(`🧩 [${reqId}] resolvedPaymentId`, resolvedPaymentId)

      if (!resolvedPaymentId) {
        return res.status(200).send('ignored')
      }
    }

    if (!resolvedPaymentId) {
      console.warn(`⚠️ [${reqId}] Sin paymentId`)
      return res.status(200).send('ignored')
    }

    // --------------------------------------------------
    // CONSULTAR PAYMENT REAL
    // --------------------------------------------------
    console.log(`➡️ [${reqId}] Consultando payment`, resolvedPaymentId)

    const payUrl = `https://api.mercadopago.com/v1/payments/${resolvedPaymentId}`
    const mpRes = await fetch(payUrl, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      console.error(`❌ [${reqId}] MP fetch error`)
      return res.status(200).send('ignored')
    }

    const payment = await mpRes.json()

    console.log(`💰 [${reqId}] PAYMENT`, payment)

    const pagoId = safeStr(payment.external_reference)

    if (!pagoId) {
      console.warn(`⚠️ [${reqId}] Sin external_reference`)
      return res.status(200).send('ignored')
    }

    // --------------------------------------------------
    // FIRESTORE
    // --------------------------------------------------
    console.log(`📄 [${reqId}] Buscando pago en Firestore`, pagoId)

    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      console.error(`❌ [${reqId}] PAGO NO EXISTE EN FIRESTORE`, pagoId)
      return res.status(200).send('missing_pago')
    }

    const pago = pagoSnap.data()

    console.log(`📄 [${reqId}] PAGO FS`, pago)

    if (pago.estado === 'aprobado') {
      console.log(`ℹ️ [${reqId}] Ya aprobado`)
      return res.status(200).send('ok')
    }

    // --------------------------------------------------
    // VALIDAR MONTO
    // --------------------------------------------------
    const mpCents = cents(payment.transaction_amount)
    const fsCents = cents(pago.total)

    console.log(`🧮 [${reqId}] MONTO`, { mpCents, fsCents })

    if (!Number.isFinite(mpCents) || mpCents !== fsCents) {
      console.error(`❌ [${reqId}] MONTO INVALIDO`)
      await pagoRef.update({
        estado: 'monto_invalido',
        updatedAt: now,
      })
      return res.status(200).send('monto invalido')
    }

    // --------------------------------------------------
    // NO APROBADO
    // --------------------------------------------------
    if (payment.status !== 'approved') {
      console.log(`⏳ [${reqId}] Aún no aprobado`, payment.status)

      await pagoRef.update({
        estado:
          payment.status === 'rejected' || payment.status === 'cancelled'
            ? 'rechazado'
            : 'pendiente',
        mpPaymentId: payment.id,
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        updatedAt: now,
      })

      return res.status(200).send('pending')
    }

    // --------------------------------------------------
    // ✅ APROBADO
    // --------------------------------------------------
    console.log(`🟢 [${reqId}] APROBADO`)

    await pagoRef.update({
      estado: 'aprobado',
      approvedAt: now,
      mpPaymentId: payment.id,
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      updatedAt: now,
    })

    console.log(`🎟️ [${reqId}] Generando entradas`)
    await generarEntradasPagasDesdePago(pagoId, pago)

    console.log(`✅ [${reqId}] WEBHOOK OK`, Date.now() - t0, 'ms')
    return res.status(200).send('ok')
  } catch (err) {
    console.error(`❌ [${reqId}] ERROR`, err)
    return res.status(200).send('error')
  }
}
