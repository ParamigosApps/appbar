// /api/webhook-mp.js
export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: true,
  },
}

import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

function safeStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function asNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function cents(v) {
  const n = asNumber(v)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

async function safeReadBody(req) {
  // En Vercel suele venir parseado si es JSON, pero lo hacemos bulletproof.
  const b = req.body
  if (!b) return {}
  if (typeof b === 'object') return b

  // Si por algún motivo llegó como string
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return { _raw: b }
    }
  }
  return {}
}

export default async function handler(req, res) {
  const reqId = `wh_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const t0 = Date.now()

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
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
    // WEBHOOK INPUT (compat: v1 + v2)
    // --------------------------------------------------
    const topic =
      safeStr(body.type) || safeStr(body.topic) || safeStr(req.query.topic)
    const action = safeStr(body.action) || safeStr(req.query.action)

    // payment id puede venir en:
    // - body.data.id (v2)
    // - query id (v1)
    // - query data.id / data[id]
    const paymentId =
      safeStr(body?.data?.id) ||
      safeStr(req.query.id) ||
      safeStr(req.query['data.id']) ||
      safeStr(req.query['data[id]'])

    // merchant_order id puede venir en:
    const merchantOrderId =
      safeStr(body?.data?.id) ||
      safeStr(req.query.id) ||
      safeStr(req.query['data.id']) ||
      safeStr(req.query['data[id]'])

    console.log(`📩 [${reqId}] webhook recibido`, {
      method: req.method,
      topic,
      action,
      paymentId,
      query: req.query,
      bodyKeys: Object.keys(body || {}),
      hasBody: !!req.body,
      elapsedMs: Date.now() - t0,
    })
    // --------------------------------------------------
    // IGNORAR payment.created (llega siempre en pending)
    // --------------------------------------------------
    if (action === 'payment.created') {
      console.log(`ℹ️ [${reqId}] payment.created ignorado`)
      return res.status(200).send('ignored created')
    }

    // --------------------------------------------------
    // Resolver a paymentId real (si vino merchant_order)
    // --------------------------------------------------
    let resolvedPaymentId = paymentId

    // Si topic dice merchant_order, primero traemos la orden y de ahí el pago
    if (!resolvedPaymentId && topic === 'merchant_order') {
      console.warn(`⚠️ [${reqId}] merchant_order sin id`, {
        topic,
        merchantOrderId,
      })
      return res.status(200).send('no merchant_order id')
    }

    if (topic === 'merchant_order') {
      const moUrl = `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`
      console.log(`➡️ [${reqId}] consultando merchant_order`, { moUrl })

      const moRes = await fetch(moUrl, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      })

      if (!moRes.ok) {
        const text = await moRes.text().catch(() => '')
        console.error(`❌ [${reqId}] merchant_order fetch error`, {
          status: moRes.status,
          text: text?.slice?.(0, 500),
        })
        return res.status(200).send('merchant_order error')
      }

      const mo = await moRes.json()

      // Intentar extraer un payment id de la orden
      const payments = Array.isArray(mo?.payments) ? mo.payments : []
      const approved = payments.find(p => safeStr(p?.status) === 'approved')
      const last = payments[payments.length - 1]

      resolvedPaymentId = safeStr(approved?.id) || safeStr(last?.id)

      console.log(`🧩 [${reqId}] merchant_order resuelto`, {
        merchantOrderId,
        paymentsCount: payments.length,
        resolvedPaymentId,
      })

      if (!resolvedPaymentId) {
        console.warn(`⚠️ [${reqId}] merchant_order sin payments`, {
          merchantOrderId,
          paymentsCount: payments.length,
        })
        return res.status(200).send('no payments in merchant_order')
      }
    }

    // Si topic no es payment ni merchant_order, NO cortamos: log y seguimos solo si tenemos id.
    if (!resolvedPaymentId) {
      console.warn(`⚠️ [${reqId}] sin paymentId resolvible`, {
        topic,
        action,
        body,
        query: req.query,
      })
      return res.status(200).send('no paymentId')
    }

    // --------------------------------------------------
    // CONSULTAR MP PAYMENT
    // --------------------------------------------------
    const payUrl = `https://api.mercadopago.com/v1/payments/${resolvedPaymentId}`
    console.log(`➡️ [${reqId}] consultando MP payment`, { payUrl })

    const mpRes = await fetch(payUrl, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      const text = await mpRes.text().catch(() => '')
      console.error(`❌ [${reqId}] MP payment fetch error`, {
        status: mpRes.status,
        text: text?.slice?.(0, 500),
      })
      return res.status(200).send('mp error')
    }

    const payment = await mpRes.json()
    const pagoId = safeStr(payment?.external_reference)

    console.log(`✅ [${reqId}] MP payment obtenido`, {
      paymentId: payment?.id,
      status: payment?.status,
      status_detail: payment?.status_detail,
      transaction_amount: payment?.transaction_amount,
      external_reference: pagoId,
    })

    if (!pagoId) return res.status(200).send('no external_reference')

    // --------------------------------------------------
    // OBTENER PAGO FIRESTORE
    // --------------------------------------------------
    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      console.warn(`⚠️ [${reqId}] pago inexistente en firestore`, { pagoId })
      return res.status(200).send('pago inexistente')
    }

    const pago = pagoSnap.data()

    console.log(`📄 [${reqId}] pago firestore`, {
      pagoId,
      estado: pago?.estado,
      fsTotal: pago?.total,
      usuarioId: pago?.usuarioId || null,
    })

    // --------------------------------------------------
    // IDEMPOTENCIA
    // --------------------------------------------------
    if (pago?.estado === 'aprobado') {
      console.log(`ℹ️ [${reqId}] ya aprobado (idempotente)`, { pagoId })
      return res.status(200).send('ya aprobado')
    }

    // --------------------------------------------------
    // VALIDAR MONTO (robusto a decimales)
    // --------------------------------------------------
    const mpCents = cents(payment?.transaction_amount)
    const fsCents = cents(pago?.total)

    console.log(`🧮 [${reqId}] comparación monto`, {
      mpAmount: payment?.transaction_amount,
      fsTotal: pago?.total,
      mpCents,
      fsCents,
    })

    if (
      !Number.isFinite(mpCents) ||
      !Number.isFinite(fsCents) ||
      mpCents !== fsCents
    ) {
      console.error(`❌ [${reqId}] monto invalido`, {
        mpAmount: payment?.transaction_amount,
        fsTotal: pago?.total,
        mpCents,
        fsCents,
      })

      await pagoRef.update({
        estado: 'monto_invalido',
        mpPaymentId: payment?.id || null,
        mpStatus: payment?.status || null,
        mpDetail: payment?.status_detail || null,
        updatedAt: now,
      })

      return res.status(200).send('monto invalido')
    }

    // --------------------------------------------------
    // REPARAR DATOS DE USUARIO
    // --------------------------------------------------
    let usuarioEmail = safeStr(pago?.usuarioEmail)
    let usuarioNombre = safeStr(pago?.usuarioNombre)

    if (!usuarioEmail) usuarioEmail = safeStr(payment?.payer?.email)

    if (!usuarioNombre) {
      const fn = safeStr(payment?.payer?.first_name)
      const ln = safeStr(payment?.payer?.last_name)
      usuarioNombre = safeStr(`${fn} ${ln}`.trim())
    }

    if ((!usuarioEmail || !usuarioNombre) && pago?.usuarioId) {
      try {
        const uSnap = await db.collection('usuarios').doc(pago.usuarioId).get()
        if (uSnap.exists) {
          const u = uSnap.data()
          if (!usuarioEmail) usuarioEmail = safeStr(u.email)
          if (!usuarioNombre) usuarioNombre = safeStr(u.nombre || u.displayName)
          console.log(`🧩 [${reqId}] usuario reparado desde /usuarios`, {
            usuarioEmailFilled: !!usuarioEmail,
            usuarioNombreFilled: !!usuarioNombre,
          })
        }
      } catch (e) {
        console.error(`⚠️ [${reqId}] error leyendo /usuarios`, {
          message: e?.message,
        })
      }
    }

    // --------------------------------------------------
    // NO APROBADO: persistir estado MP
    // --------------------------------------------------
    if (payment.status !== 'approved') {
      console.log(`🟡 [${reqId}] pago aún no aprobado`, {
        status: payment.status,
        detail: payment.status_detail,
      })
      if (payment.status === 'rejected' || payment.status === 'cancelled') {
        await pagoRef.update({
          estado: 'rechazado',
          mpPaymentId: payment.id,
          mpStatus: payment.status,
          mpDetail: payment.status_detail,
          updatedAt: now,
          ...(usuarioEmail ? { usuarioEmail } : {}),
          ...(usuarioNombre ? { usuarioNombre } : {}),
        })
        return res.status(200).send('rechazado')
      }

      await pagoRef.update({
        estado: 'pendiente',
        mpPaymentId: payment.id,
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        updatedAt: now,
        ...(usuarioEmail ? { usuarioEmail } : {}),
        ...(usuarioNombre ? { usuarioNombre } : {}),
      })

      console.log(`🟡 [${reqId}] firestore actualizado (pendiente)`, {
        pagoId,
        elapsedMs: Date.now() - t0,
      })

      return res.status(200).send('pendiente')
    }

    // --------------------------------------------------
    // ✅ APROBADO
    // --------------------------------------------------
    console.log(`🟢 [${reqId}] APROBADO -> actualizando firestore`, {
      pagoId,
      mpPaymentId: payment.id,
      detail: payment.status_detail,
    })

    await pagoRef.update({
      estado: 'aprobado',
      approvedAt: now,
      mpPaymentId: payment.id,
      mpStatus: payment.status,
      mpDetail: payment.status_detail,
      updatedAt: now,
      ...(usuarioEmail ? { usuarioEmail } : {}),
      ...(usuarioNombre ? { usuarioNombre } : {}),
    })

    // --------------------------------------------------
    // GENERAR ENTRADAS
    // --------------------------------------------------
    console.log(`🎟️ [${reqId}] generarEntradasPagasDesdePago START`, { pagoId })
    await generarEntradasPagasDesdePago(pagoId, pago)
    console.log(`✅ [${reqId}] generarEntradasPagasDesdePago OK`, { pagoId })

    console.log(`✅ [${reqId}] webhook OK`, {
      pagoId,
      elapsedMs: Date.now() - t0,
    })

    return res.status(200).send('aprobado')
  } catch (err) {
    console.error(`❌ [${reqId}] WEBHOOK ERROR`, {
      message: err?.message,
      stack: err?.stack,
    })
    return res.status(200).send('error')
  }
}
