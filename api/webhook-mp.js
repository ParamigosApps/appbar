// --------------------------------------------------
// /api/webhook-mercadopago.js
// WEBHOOK MERCADO PAGO — PRODUCCIÓN FINAL (CORREGIDO)
// --------------------------------------------------

import admin from 'firebase-admin'
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
const { serverTimestamp } = admin.firestore.FieldValue

export default async function handler(req, res) {
  // --------------------------------------------------
  // 🔒 Solo POST (MP reintenta igual con 200)
  // --------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(200).send('method ignored')
  }

  try {
    const body = req.body || {}
    const tipo = body.type || body.topic
    const paymentId = body?.data?.id

    // --------------------------------------------------
    // ⛔ Ignorar eventos que no sean pagos
    // --------------------------------------------------
    if (tipo !== 'payment') {
      return res.status(200).send('ignored')
    }

    if (!paymentId) {
      console.warn('⚠️ Webhook sin paymentId')
      return res.status(200).send('payment id missing')
    }

    // --------------------------------------------------
    // 🔎 Consultar estado REAL en Mercado Pago
    // --------------------------------------------------
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )

    if (!mpRes.ok) {
      console.error('❌ Error consultando MP:', mpRes.status)
      return res.status(200).send('mp fetch error')
    }

    const payment = await mpRes.json()

    // --------------------------------------------------
    // 🔑 external_reference = pagoId Firestore
    // --------------------------------------------------
    const pagoId = payment.external_reference
    if (!pagoId) {
      console.error('❌ external_reference faltante')
      return res.status(200).send('external_reference missing')
    }

    // --------------------------------------------------
    // 🔎 Buscar pago en Firestore
    // --------------------------------------------------
    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      console.error('❌ Pago no encontrado:', pagoId)
      return res.status(200).send('pago no encontrado')
    }

    const pago = pagoSnap.data()

    // --------------------------------------------------
    // 🔐 IDEMPOTENCIA DURA — ENTRADAS YA GENERADAS
    // --------------------------------------------------
    if (pago.entradasPagasGeneradas === true) {
      return res.status(200).send('entradas ya generadas')
    }

    // --------------------------------------------------
    // 🔐 IDEMPOTENCIA POR ESTADOS FINALES
    // --------------------------------------------------
    const ESTADOS_FINALES = ['aprobado', 'fallido', 'monto_invalido']
    if (ESTADOS_FINALES.includes(pago.estado)) {
      return res.status(200).send('ya procesado')
    }

    // --------------------------------------------------
    // 💰 VALIDAR MONTO (ANTIFRAUDE)
    // --------------------------------------------------
    const montoMP = Number(payment.transaction_amount)
    const montoDB = Number(pago.total)

    if (!Number.isFinite(montoMP) || !Number.isFinite(montoDB)) {
      console.error('❌ Monto inválido', { montoMP, montoDB })
      return res.status(200).send('monto invalido')
    }

    if (montoMP !== montoDB) {
      console.error('❌ Monto no coincide', { pagoId, montoMP, montoDB })

      await pagoRef.update({
        estado: 'monto_invalido',
        paymentId,
        log: {
          ultimoEvento: 'mismatch_monto',
          mpMonto: montoMP,
          dbMonto: montoDB,
          webhookAt: serverTimestamp(),
        },
      })

      return res.status(200).send('monto mismatch')
    }

    // --------------------------------------------------
    // ⛔ Estados fallidos
    // --------------------------------------------------
    const ESTADOS_FALLIDOS = [
      'rejected',
      'cancelled',
      'refunded',
      'charged_back',
    ]

    if (ESTADOS_FALLIDOS.includes(payment.status)) {
      await pagoRef.update({
        estado: 'fallido',
        paymentId,
        log: {
          ultimoEvento: payment.status,
          webhookAt: serverTimestamp(),
        },
      })

      return res.status(200).send('pago fallido')
    }

    // --------------------------------------------------
    // ⏳ Aún no aprobado
    // --------------------------------------------------
    if (payment.status !== 'approved') {
      return res.status(200).send('pago pendiente')
    }

    // --------------------------------------------------
    // ✅ MARCAR PAGO COMO APROBADO
    // --------------------------------------------------
    await pagoRef.update({
      estado: 'aprobado',
      paymentId,
      approvedAt: serverTimestamp(),
      log: {
        ultimoEvento: 'approved',
        mpStatus: payment.status,
        webhookAt: serverTimestamp(),
      },
    })

    // --------------------------------------------------
    // 🎟️ GENERAR ENTRADAS PAGAS (SOLO UNA VEZ)
    // --------------------------------------------------
    await generarEntradasPagasDesdePago(pagoId, pago)

    console.log('✅ Pago aprobado y entradas generadas:', pagoId)
    return res.status(200).send('ok')
  } catch (err) {
    console.error('❌ Webhook MP error:', err)
    return res.status(200).send('error')
  }
}
