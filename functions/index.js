const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')
const fetch = require('node-fetch')

admin.initializeApp()
setGlobalOptions({ maxInstances: 10 })

const cents = v =>
  Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : NaN

exports.processWebhookEvent = onDocumentCreated(
  'webhook_events/{id}',
  async event => {
    const snap = event.data
    if (!snap) return

    const data = snap.data()
    if (data.topic !== 'payment' || !data.paymentId) return

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
    const MP_COLLECTOR_ID = Number(process.env.MP_COLLECTOR_ID)

    let payment = null

    // Reintentos MP
    for (let i = 0; i < 5; i++) {
      const r = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.paymentId}`,
        { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
      )
      if (r.ok) {
        payment = await r.json()
        break
      }
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }

    if (!payment) {
      await snap.ref.set({ note: 'mp_no_response' }, { merge: true })
      return
    }

    if (MP_COLLECTOR_ID && payment.collector_id !== MP_COLLECTOR_ID) {
      await snap.ref.set({ note: 'collector_mismatch' }, { merge: true })
      return
    }

    const pagoId = payment.external_reference
    if (!pagoId) {
      await snap.ref.set({ note: 'sin_external_reference' }, { merge: true })
      return
    }

    const pagoRef = admin.firestore().collection('pagos').doc(pagoId)
    const pagoSnap = await pagoRef.get()
    if (!pagoSnap.exists) {
      await snap.ref.set({ note: 'pago_no_encontrado' }, { merge: true })
      return
    }

    const pago = pagoSnap.data()
    const now = admin.firestore.FieldValue.serverTimestamp()

    if (cents(payment.transaction_amount) !== cents(pago.total)) {
      await pagoRef.update({
        estado: 'monto_invalido',
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        mpPaymentId: payment.id,
        updatedAt: now,
      })
      await snap.ref.set({ processed: true }, { merge: true })
      return
    }

    if (payment.status === 'approved') {
      await pagoRef.update({
        estado: 'aprobado',
        mpStatus: payment.status,
        mpDetail: payment.status_detail,
        mpPaymentId: payment.id,
        approvedAt: now,
        updatedAt: now,
      })
    } else {
      let estado = 'pendiente_mp'
      if (['rejected', 'cancelled'].includes(payment.status))
        estado = 'rechazado'

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
  }
)
