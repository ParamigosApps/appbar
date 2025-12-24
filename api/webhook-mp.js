// --------------------------------------------------
// /api/webhook-mercadopago.js
// --------------------------------------------------

import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../src/Firebase.js'
import { entregarEntradasGratisPostPago } from '../src/logic/entradas/entradasGratis.js'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

export default async function handler(req, res) {
  try {
    const { type, data } = req.body

    // --------------------------------------------------
    // ⛔ Ignorar eventos que no sean pagos
    // --------------------------------------------------
    if (type !== 'payment') {
      return res.status(200).send('ignored')
    }

    const paymentId = data?.id
    if (!paymentId) {
      return res.status(400).send('payment id missing')
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
      throw new Error('No se pudo consultar Mercado Pago')
    }

    const payment = await mpRes.json()

    // --------------------------------------------------
    // ⛔ Estados fallidos → no entregar nada
    // (los cupos se liberan por tu limpieza periódica)
    // --------------------------------------------------
    const ESTADOS_FALLIDOS = [
      'rejected',
      'cancelled',
      'refunded',
      'charged_back',
    ]

    if (ESTADOS_FALLIDOS.includes(payment.status)) {
      return res.status(200).send('pago fallido')
    }

    // --------------------------------------------------
    // ⏳ Aún no aprobado
    // --------------------------------------------------
    if (payment.status !== 'approved') {
      return res.status(200).send('pago pendiente')
    }

    // --------------------------------------------------
    // 🔑 external_reference = ID del doc en Firestore
    // --------------------------------------------------
    const pagoId = payment.external_reference

    if (!pagoId) {
      return res.status(400).send('external_reference faltante')
    }

    // --------------------------------------------------
    // 🔎 Buscar pago en Firestore
    // --------------------------------------------------
    const pagoRef = doc(db, 'pagos', pagoId)
    const pagoSnap = await getDoc(pagoRef)

    if (!pagoSnap.exists()) {
      return res.status(404).send('pago no encontrado')
    }

    const pago = pagoSnap.data()

    // --------------------------------------------------
    // 🔐 IDEMPOTENCIA (MP reintenta webhooks)
    // --------------------------------------------------
    if (pago.gratisEntregadas) {
      return res.status(200).send('ya procesado')
    }

    // --------------------------------------------------
    // 🎟️ ENTREGAR ENTRADAS GRATIS POST-PAGO
    // --------------------------------------------------
    await entregarEntradasGratisPostPago({
      eventoId: pago.eventoId,
      usuarioId: pago.usuarioId,
      usuarioNombre: pago.usuarioNombre,
      usuarioEmail: pago.usuarioEmail,
      entradasGratisPendientes: pago.entradasGratisPendientes,
    })

    // --------------------------------------------------
    // ✅ MARCAR COMO PROCESADO
    // --------------------------------------------------
    await updateDoc(pagoRef, {
      estado: 'approved',
      gratisEntregadas: true,
      paymentId,
      approvedAt: new Date(),
      log: {
        ultimoEvento: 'approved',
        webhookAt: new Date(),
      },
    })

    return res.status(200).send('ok')
  } catch (err) {
    console.error('❌ Webhook MP error:', err)
    return res.status(500).send('error')
  }
}
