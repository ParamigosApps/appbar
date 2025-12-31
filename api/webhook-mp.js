import admin from 'firebase-admin'
import fetch from 'node-fetch'

import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  })
}

const db = admin.firestore()
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('method ignored')
  }

  try {
    const body = req.body || {}

    const topic = body.type || body.topic || req.query.type || req.query.topic

    const paymentId = body?.data?.id || req.query.id || req.query['data.id']

    console.log('📩 WEBHOOK MP RAW', {
      method: req.method,
      topic,
      paymentId,
      body,
      query: req.query,
    })

    if (!paymentId) {
      console.warn('⚠️ Webhook sin paymentId')
      return res.status(200).send('no paymentId')
    }

    if (topic && topic !== 'payment') {
      return res.status(200).send('ignored topic')
    }

    // 🔎 Consultar MP
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )

    if (!mpRes.ok) {
      console.error('❌ Error MP status:', mpRes.status)
      return res.status(200).send('mp error')
    }

    const payment = await mpRes.json()

    console.log('💳 PAYMENT MP', {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      external_reference: payment.external_reference,
    })

    const pagoId = payment.external_reference
    if (!pagoId) {
      return res.status(200).send('no external_reference')
    }

    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      return res.status(200).send('pago inexistente')
    }

    const pago = pagoSnap.data()

    // 🔐 Idempotencia
    if (['aprobado', 'fallido', 'monto_invalido'].includes(pago.estado)) {
      return res.status(200).send('ya procesado')
    }

    // 💰 Validar monto
    if (Number(payment.transaction_amount) !== Number(pago.total)) {
      await pagoRef.update({
        estado: 'monto_invalido',
        paymentId,
        log: {
          error: 'monto mismatch',
          mpMonto: payment.transaction_amount,
          dbMonto: pago.total,
          at: serverTimestamp(),
        },
      })

      // ❌ NO TOCAR compras
      return res.status(200).send('monto invalido')
    }

    // ❌ Estados fallidos
    if (
      ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(
        payment.status
      )
    ) {
      await pagoRef.update({
        estado: 'fallido',
        paymentId,
        log: {
          status: payment.status,
          status_detail: payment.status_detail,
          at: serverTimestamp(),
        },
      })

      return res.status(200).send('fallido')
    }

    // ⏳ Pendiente
    if (payment.status !== 'approved') {
      await pagoRef.update({
        log: {
          ...(pago.log || {}),
          lastMpStatus: payment.status,
          lastMpDetail: payment.status_detail,
          lastCheckAt: serverTimestamp(),
        },
      })

      console.log('⏳ Pago pendiente en MP', payment.status)

      return res.status(200).send('pendiente')
    }

    // ✅ APROBAR PAGO
    await pagoRef.update({
      estado: 'aprobado',
      paymentId,
      approvedAt: serverTimestamp(),
      log: {
        status: 'approved',
        status_detail: payment.status_detail,
        at: serverTimestamp(),
      },
    })

    // 🔗 MARCAR COMPRA COMO PAGADA
    const compraSnap = await db
      .collection('compras')
      .where('ticketId', '==', pagoId)
      .limit(1)
      .get()

    if (!compraSnap.empty) {
      await compraSnap.docs[0].ref.update({
        estado: 'pagado',
        pagado: true,
        pagadoAt: serverTimestamp(),
      })
    }

    // 🎟️ Generar entradas (NO BLOQUEANTE)
    try {
      await generarEntradasPagasDesdePago(pagoId, pago)
    } catch (err) {
      console.error('❌ Error generando entradas:', err)

      await pagoRef.update({
        log: {
          ...(pago.log || {}),
          errorEntradas: err.message || 'error entradas',
          errorEntradasAt: serverTimestamp(),
        },
      })
    }

    return res.status(200).send('ok')
  } catch (err) {
    console.error('❌ Webhook fatal:', err)
    return res.status(200).send('error')
  }
}
