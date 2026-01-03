// functions/index.js
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')
const fetch = require('node-fetch')

admin.initializeApp()

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
})

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms))

const cents = v =>
  Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN

async function mpGet(url, token, retries = 5) {
  let lastErr = null

  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) return await r.json()
      lastErr = await r.text()
    } catch (e) {
      lastErr = e.message
    }
    await sleep(800 * (i + 1))
  }

  throw new Error(`MP fetch failed: ${lastErr}`)
}

// --------------------------------------------------
// Función principal
// --------------------------------------------------
exports.processWebhookEvent = onDocumentCreated(
  'webhook_events/{id}',
  async event => {
    const snap = event.data
    if (!snap) return

    const data = snap.data()
    if (!data || !data.topic || !data.refId) return

    const {
      topic, // 'payment' | 'merchant_order'
      refId, // paymentId | orderId
      processed,
    } = data

    // Idempotencia dura
    if (processed) return

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
    const MP_COLLECTOR_ID = Number(process.env.MP_COLLECTOR_ID || 0)

    if (!MP_ACCESS_TOKEN) {
      await snap.ref.set({ note: 'mp_access_token_missing' }, { merge: true })
      return
    }

    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    try {
      // --------------------------------------------------
      // 🔵 CASO 1: EVENTO PAYMENT
      // --------------------------------------------------
      if (topic === 'payment') {
        const payment = await mpGet(
          `https://api.mercadopago.com/v1/payments/${refId}`,
          MP_ACCESS_TOKEN
        )

        if (MP_COLLECTOR_ID && payment.collector_id !== MP_COLLECTOR_ID) {
          await snap.ref.set(
            { note: 'collector_mismatch', processed: true },
            { merge: true }
          )
          return
        }

        const pagoId = payment.external_reference
        if (!pagoId) {
          await snap.ref.set(
            { note: 'sin_external_reference', processed: true },
            { merge: true }
          )
          return
        }

        const pagoRef = db.collection('pagos').doc(pagoId)
        const pagoSnap = await pagoRef.get()

        if (!pagoSnap.exists) {
          await snap.ref.set(
            { note: 'pago_no_encontrado', processed: true },
            { merge: true }
          )
          return
        }

        const pago = pagoSnap.data()

        if (cents(payment.transaction_amount) !== cents(pago.total)) {
          await pagoRef.update({
            estado: 'monto_invalido',
            mpStatus: payment.status,
            mpDetail: payment.status_detail,
            mpPaymentId: payment.id,
            updatedAt: now,
          })
        } else if (payment.status === 'approved') {
          await pagoRef.update({
            estado: 'aprobado',
            mpStatus: payment.status,
            mpDetail: payment.status_detail,
            mpPaymentId: payment.id,
            approvedAt: now,
            updatedAt: now,
          })
        } else {
          const estado =
            payment.status === 'rejected' || payment.status === 'cancelled'
              ? 'rechazado'
              : 'pendiente_mp'

          await pagoRef.update({
            estado,
            mpStatus: payment.status,
            mpDetail: payment.status_detail,
            mpPaymentId: payment.id,
            updatedAt: now,
          })
        }

        await snap.ref.set(
          {
            processed: true,
            payment_status: payment.status,
            processedAt: now,
          },
          { merge: true }
        )

        return
      }

      // --------------------------------------------------
      // 🟣 CASO 2: EVENTO MERCHANT_ORDER
      // --------------------------------------------------
      if (topic === 'merchant_order') {
        const order = await mpGet(
          `https://api.mercadopago.com/merchant_orders/${refId}`,
          MP_ACCESS_TOKEN
        )

        const payments = Array.isArray(order.payments) ? order.payments : []

        if (!payments.length) {
          await snap.ref.set(
            { note: 'order_sin_pagos', processed: true },
            { merge: true }
          )
          return
        }

        for (const p of payments) {
          if (!p.external_reference) continue

          const pagoRef = db.collection('pagos').doc(p.external_reference)
          const pagoSnap = await pagoRef.get()
          if (!pagoSnap.exists) continue

          const pago = pagoSnap.data()

          if (cents(p.transaction_amount) !== cents(pago.total)) {
            await pagoRef.update({
              estado: 'monto_invalido',
              mpStatus: p.status,
              mpPaymentId: p.id,
              updatedAt: now,
            })
            continue
          }

          if (p.status === 'approved') {
            await pagoRef.update({
              estado: 'aprobado',
              mpStatus: p.status,
              mpPaymentId: p.id,
              approvedAt: now,
              updatedAt: now,
            })
          } else {
            const estado =
              p.status === 'rejected' || p.status === 'cancelled'
                ? 'rechazado'
                : 'pendiente_mp'

            await pagoRef.update({
              estado,
              mpStatus: p.status,
              mpPaymentId: p.id,
              updatedAt: now,
            })
          }
        }

        await snap.ref.set(
          {
            processed: true,
            paymentsCount: payments.length,
            processedAt: now,
          },
          { merge: true }
        )

        return
      }
    } catch (err) {
      await snap.ref.set(
        {
          error: err.message || String(err),
          processedAt: now,
        },
        { merge: true }
      )
    }
  }
)
