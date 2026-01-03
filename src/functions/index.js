const functions = require('firebase-functions')
const admin = require('firebase-admin')
const fetch = require('node-fetch')

admin.initializeApp()

const db = admin.firestore()

const cents = v =>
  Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN

const sleep = ms => new Promise(r => setTimeout(r, ms))

exports.processWebhookEvent = functions.firestore
  .document('webhook_events/{eventId}')
  .onCreate(async (snap, context) => {
    const data = snap.data()
    const now = admin.firestore.FieldValue.serverTimestamp()

    if (!data || data.topic !== 'payment' || !data.paymentId) {
      return
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
    const MP_COLLECTOR_ID = process.env.MP_COLLECTOR_ID
      ? Number(process.env.MP_COLLECTOR_ID)
      : null

    if (!MP_ACCESS_TOKEN) {
      await snap.ref.set(
        { note: 'missing_mp_access_token', processed: false },
        { merge: true }
      )
      return
    }

    // -----------------------------
    // CONSULTAR PAYMENT EN MP
    // -----------------------------
    let payment = null
    let lastError = null

    for (let i = 0; i < 5; i++) {
      try {
        const r = await fetch(
          `https://api.mercadopago.com/v1/payments/${data.paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            },
          }
        )

        if (r.ok) {
          payment = await r.json()
          break
        } else {
          lastError = r.status
        }
      } catch (e) {
        lastError = e.message
      }

      await sleep(800 * (i + 1))
    }

    if (!payment) {
      await snap.ref.set(
        {
          note: 'payment_not_found',
          last_error: lastError,
          processed: false,
          updatedAt: now,
        },
        { merge: true }
      )
      return
    }

    // -----------------------------
    // VALIDACIONES DE SEGURIDAD
    // -----------------------------
    if (payment.live_mode !== true) {
      await snap.ref.set(
        { note: 'not_live_mode', processed: false, updatedAt: now },
        { merge: true }
      )
      return
    }

    if (MP_COLLECTOR_ID && Number(payment.collector_id) !== MP_COLLECTOR_ID) {
      await snap.ref.set(
        {
          note: 'collector_mismatch',
          expected: MP_COLLECTOR_ID,
          actual: payment.collector_id,
          processed: false,
          updatedAt: now,
        },
        { merge: true }
      )
      return
    }

    // -----------------------------
    // RESOLVER PAGO INTERNO
    // -----------------------------
    const pagoId = payment.external_reference

    if (!pagoId) {
      await snap.ref.set(
        { note: 'missing_external_reference', processed: false },
        { merge: true }
      )
      return
    }

    const pagoRef = db.collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()

    if (!pagoSnap.exists) {
      await snap.ref.set(
        { note: 'pago_not_found', processed: false },
        { merge: true }
      )
      return
    }

    const pago = pagoSnap.data()

    // -----------------------------
    // VALIDAR MONTO
    // -----------------------------
    const expectedCents = cents(pago.total)
    const paidCents = cents(payment.transaction_amount)

    if (expectedCents !== paidCents) {
      await pagoRef.update({
        estado: 'monto_invalido',
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        mpPaymentId: payment.id,
        updatedAt: now,
      })

      await snap.ref.set(
        { note: 'amount_mismatch', processed: true, updatedAt: now },
        { merge: true }
      )
      return
    }

    // -----------------------------
    // ESTADOS DE PAGO
    // -----------------------------
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
      }
    } else {
      let estado = 'pendiente_mp'

      if (payment.status === 'rejected' || payment.status === 'cancelled')
        estado = 'rechazado'

      if (
        payment.status === 'refunded' ||
        payment.status_detail?.startsWith('partially_refunded')
      )
        estado = 'reembolsado'

      if (
        payment.status === 'charged_back' ||
        payment.status_detail?.includes('chargeback')
      )
        estado = 'reversado'

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

    // -----------------------------
    // MARCAR EVENTO PROCESADO
    // -----------------------------
    await snap.ref.set(
      {
        processed: true,
        payment_status: payment.status,
        collector_id: payment.collector_id,
        live_mode: payment.live_mode,
        processedAt: now,
      },
      { merge: true }
    )
  })
