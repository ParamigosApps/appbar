export const config = {
  runtime: 'nodejs',
}

import { getAdmin } from './_lib/firebaseAdmin.js'
import { generarEntradasPagasDesdePago } from './_lib/generarEntradasPagasDesdePago.js'

export default async function handler(req, res) {
  // -----------------------------------------
  // SOLO POST
  // -----------------------------------------
  if (req.method !== 'POST') {
    return res.status(200).send('method ignored')
  }

  try {
    // -----------------------------------------
    // VALIDAR ENV
    // -----------------------------------------
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

    if (!MP_ACCESS_TOKEN) {
      console.error('❌ MP_ACCESS_TOKEN faltante')
      return res.status(500).send('env error')
    }

    // -----------------------------------------
    // INIT FIREBASE (CENTRALIZADO)
    // -----------------------------------------
    const admin = getAdmin()
    const db = admin.firestore()
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp

    // -----------------------------------------
    // WEBHOOK DATA
    // -----------------------------------------
    const body = req.body || {}
    const topic = body.type || body.topic || req.query.topic
    const paymentId = body?.data?.id || req.query.id || req.query['data.id']

    console.log('📩 WEBHOOK MP', { topic, paymentId })

    if (!paymentId) {
      return res.status(200).send('no paymentId')
    }

    if (topic && topic !== 'payment') {
      return res.status(200).send('ignored')
    }

    // -----------------------------------------
    // CONSULTAR MERCADO PAGO (FETCH NATIVO)
    // -----------------------------------------
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )

    if (!mpRes.ok) {
      console.error('❌ Error MP:', mpRes.status)
      return res.status(200).send('mp error')
    }

    const payment = await mpRes.json()
    const pagoId = payment.external_reference

    if (!pagoId) {
      return res.status(200).send('no external_reference')
    }

    // -----------------------------------------
    // OBTENER PAGO
    // -----------------------------------------
    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      return res.status(200).send('pago inexistente')
    }

    const pago = pagoSnap.data()

    // -----------------------------------------
    // IDEMPOTENCIA
    // -----------------------------------------
    if (['aprobado', 'fallido', 'monto_invalido'].includes(pago.estado)) {
      return res.status(200).send('ya procesado')
    }

    // -----------------------------------------
    // VALIDAR MONTO
    // -----------------------------------------
    if (Number(payment.transaction_amount) !== Number(pago.total)) {
      await pagoRef.update({
        estado: 'monto_invalido',
        at: serverTimestamp(),
      })
      return res.status(200).send('monto invalido')
    }

    // -----------------------------------------
    // ESTADO MP
    // -----------------------------------------
    if (payment.status !== 'approved') {
      await pagoRef.update({
        estado: 'pendiente',
        lastMpStatus: payment.status,
        at: serverTimestamp(),
      })
      return res.status(200).send('pendiente')
    }

    // -----------------------------------------
    // APROBAR PAGO
    // -----------------------------------------
    await pagoRef.update({
      estado: 'aprobado',
      approvedAt: serverTimestamp(),
    })

    // -----------------------------------------
    // GENERAR ENTRADAS
    // -----------------------------------------
    await generarEntradasPagasDesdePago(pagoId, pago)

    return res.status(200).send('ok')
  } catch (err) {
    console.error('❌ WEBHOOK ERROR', err)
    return res.status(200).send('error')
  }
}
