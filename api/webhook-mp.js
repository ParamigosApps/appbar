// /api/mp-webhook.js
export const config = { runtime: 'nodejs' }

import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

function safeStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

export default async function handler(req, res) {
  const reqId = `wh_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const t0 = Date.now()

  if (req.method !== 'POST') {
    console.log(`ℹ️ [${reqId}] method ignored`, { method: req.method })
    return res.status(200).send('ignored')
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

    // --------------------------------------------------
    // WEBHOOK INPUT
    // --------------------------------------------------
    const body = req.body || {}
    const topic = body.type || body.topic || req.query.topic
    const paymentId = body?.data?.id || req.query.id || req.query['data.id']

    console.log(`📩 [${reqId}] webhook recibido`, {
      topic,
      paymentId,
      query: req.query,
      bodyKeys: Object.keys(body || {}),
    })

    if (!paymentId) {
      console.warn(`⚠️ [${reqId}] sin paymentId`, { body, query: req.query })
      return res.status(200).send('no paymentId')
    }

    if (topic && topic !== 'payment') {
      console.log(`ℹ️ [${reqId}] topic ignorado`, { topic })
      return res.status(200).send('ignored')
    }

    // --------------------------------------------------
    // CONSULTAR MP
    // --------------------------------------------------
    const url = `https://api.mercadopago.com/v1/payments/${paymentId}`
    console.log(`➡️ [${reqId}] consultando MP`, { url })

    const mpRes = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      const text = await mpRes.text().catch(() => '')
      console.error(`❌ [${reqId}] MP fetch error`, {
        status: mpRes.status,
        text: text?.slice?.(0, 500),
      })
      return res.status(200).send('mp error')
    }

    const payment = await mpRes.json()
    const pagoId = payment.external_reference

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
      total: pago?.total,
      usuarioId: pago?.usuarioId || null,
      usuarioEmailEmpty: !safeStr(pago?.usuarioEmail),
      usuarioNombreEmpty: !safeStr(pago?.usuarioNombre),
    })

    // --------------------------------------------------
    // IDEMPOTENCIA
    // --------------------------------------------------
    if (pago?.estado === 'aprobado') {
      console.log(`ℹ️ [${reqId}] ya aprobado (idempotente)`, { pagoId })
      return res.status(200).send('ya aprobado')
    }

    // --------------------------------------------------
    // VALIDAR MONTO
    // --------------------------------------------------
    if (Number(payment.transaction_amount) !== Number(pago.total)) {
      console.error(`❌ [${reqId}] monto invalido`, {
        mpAmount: payment.transaction_amount,
        fsTotal: pago.total,
      })

      await pagoRef.update({
        estado: 'monto_invalido',
        mpPaymentId: payment.id,
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        updatedAt: now,
      })

      return res.status(200).send('monto invalido')
    }

    // --------------------------------------------------
    // REPARAR DATOS DE USUARIO SI ESTÁN VACÍOS
    // --------------------------------------------------
    let usuarioEmail = safeStr(pago?.usuarioEmail)
    let usuarioNombre = safeStr(pago?.usuarioNombre)

    if (!usuarioEmail) {
      usuarioEmail = safeStr(payment?.payer?.email)
    }

    // Nombre: MP no siempre devuelve first_name/last_name; igual lo intentamos
    if (!usuarioNombre) {
      const fn = safeStr(payment?.payer?.first_name)
      const ln = safeStr(payment?.payer?.last_name)
      usuarioNombre = safeStr(`${fn} ${ln}`.trim())
    }

    // Si sigue vacío y tenés colección usuarios, intentamos
    if ((!usuarioEmail || !usuarioNombre) && pago?.usuarioId) {
      try {
        const uSnap = await db.collection('usuarios').doc(pago.usuarioId).get()
        if (uSnap.exists) {
          const u = uSnap.data()
          if (!usuarioEmail) usuarioEmail = safeStr(u.email)
          if (!usuarioNombre) usuarioNombre = safeStr(u.nombre || u.displayName)
          console.log(`🧩 [${reqId}] usuario reparado desde /usuarios`, {
            found: true,
            usuarioEmailFilled: !!usuarioEmail,
            usuarioNombreFilled: !!usuarioNombre,
          })
        } else {
          console.log(`🧩 [${reqId}] /usuarios no existe para uid`, {
            uid: pago.usuarioId,
          })
        }
      } catch (e) {
        console.error(`⚠️ [${reqId}] error leyendo /usuarios`, {
          message: e?.message,
        })
      }
    }

    // --------------------------------------------------
    // SI AÚN NO APROBADO: solo guardamos estado MP
    // --------------------------------------------------
    if (payment.status !== 'approved') {
      console.log(`🟡 [${reqId}] no aprobado todavía`, {
        status: payment.status,
        detail: payment.status_detail,
      })

      await pagoRef.update({
        estado: 'pendiente',
        mpPaymentId: payment.id,
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        updatedAt: now,

        // si pudimos reparar algo, lo persistimos
        ...(usuarioEmail ? { usuarioEmail } : {}),
        ...(usuarioNombre ? { usuarioNombre } : {}),
      })

      console.log(`🟡 [${reqId}] firestore actualizado a pendiente`, {
        pagoId,
        elapsedMs: Date.now() - t0,
      })

      return res.status(200).send('pendiente')
    }

    // --------------------------------------------------
    // ✅ APROBADO: confirmamos en Firestore
    // --------------------------------------------------
    console.log(`🟢 [${reqId}] APROBADO, actualizando firestore`, {
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
    // GENERAR ENTRADAS (UNA SOLA VEZ)
    // --------------------------------------------------
    console.log(`🎟️ [${reqId}] generando entradas`, { pagoId })
    await generarEntradasPagasDesdePago(pagoId, pago)

    console.log(`✅ [${reqId}] OK webhook completo`, {
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
