// functions/index.js

const {
  onDocumentCreated,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore')
const { descontarCuposArray } = require('./utils/descontarCuposArray')

const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')
const {
  generarEntradasPagasDesdePago,
} = require('./generarEntradasPagasMercadoPago.js')
admin.initializeApp()

const { crearEntradaBaseAdmin } = require('./utils/crearEntradaBaseAdmin')

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

    const topic = data.topic || data.type
    const refId = data.refId || data.paymentId || data.data?.id || data.id

    const processed = data.processed

    if (!topic || !refId) {
      await snap.ref.set({ error: 'refId_missing' }, { merge: true })
      return
    }

    // ⛔ Idempotencia SOLO real
    if (processed) return

    const mpAccessToken =
      process.env.MP_ACCESS_TOKEN ||
      require('firebase-functions').config().mp?.access_token
    const MP_COLLECTOR_ID = Number(
      process.env.MP_COLLECTOR_ID ||
        require('firebase-functions').config().mp?.collector_id ||
        0
    )
    console.log('🔑 MP_ACCESS_TOKEN presente?', !!mpAccessToken)
    if (!mpAccessToken) {
      await snap.ref.set({ note: 'mp_access_token_missing' }, { merge: true })
      return
    }

    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    try {
      // ==================================================
      // 🔵 PAYMENT (ÚNICO EVENTO DEFINITIVO)
      // ==================================================
      const IS_TEST = refId =>
        refId.startsWith('TEST_') || refId.startsWith('payment_test_')

      if (topic === 'payment' || topic === 'payments') {
        let payment

        if (IS_TEST(refId)) {
          console.log('🧪 MODO TEST ACTIVADO', refId)

          payment = {
            id: 'TEST_MP_ID',
            status: 'approved',
            status_detail: 'accredited',
            transaction_amount: 1,
            external_reference: refId,
            collector_id: MP_COLLECTOR_ID || 0,
          }
        } else {
          payment = await mpGet(
            `https://api.mercadopago.com/v1/payments/${refId}`,
            mpAccessToken
          )
        }

        if (MP_COLLECTOR_ID && payment.collector_id !== MP_COLLECTOR_ID) {
          await snap.ref.set(
            { note: 'collector_mismatch', processed: true },
            { merge: true }
          )
          return
        }
        console.log('🧾 PAYMENT RAW:', payment)
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
          await pagoRef.update({
            estado:
              payment.status === 'rejected' || payment.status === 'cancelled'
                ? 'rechazado'
                : 'pendiente_mp',
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

      // ==================================================
      // 🟣 MERCHANT_ORDER (NO DEFINITIVO)
      // ==================================================
      if (topic === 'merchant_order') {
        const order = await mpGet(
          `https://api.mercadopago.com/merchant_orders/${refId}`,
          mpAccessToken
        )

        const payments = Array.isArray(order.payments) ? order.payments : []

        // Solo log / traza
        await snap.ref.set(
          {
            processed: true,
            paymentsCount: payments.length,
            processedAt: now,
            note: 'merchant_order_seen',
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

exports.generarEntradasDesdePagoFirestore = onDocumentUpdated(
  'pagos/{pagoId}',
  async event => {
    const after = event.data.after.data()
    if (!after) {
      console.log('after no existe')
      return
    }
    if (after.estado !== 'aprobado') {
      console.log('estado no es aprobado')
      return
    }
    if (after.entradasPagasGeneradas === true) {
      console.log('entradas ya generadas')
      return
    }

    await generarEntradasPagasDesdePago(event.params.pagoId, after)
  }
)

exports.procesarEntradasGratis = onDocumentCreated(
  'entradasGratisPendientes/{id}',
  async event => {
    const snap = event.data
    if (!snap) return

    const data = snap.data()
    const { eventoId, loteIndice, cantidad, usuarioId } = data

    // ⛔ Idempotencia dura
    if (data.estado === 'procesado' || data.estado === 'procesando') {
      console.log('ℹ️ Entrada gratis ya tomada')
      return
    }

    const qty = Number(cantidad)
    if (!eventoId || !Number.isFinite(qty) || qty <= 0 || !usuarioId) {
      await snap.ref.update({
        estado: 'error',
        error: 'datos_invalidos',
      })
      return
    }

    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    try {
      // 🔹 Marcar como procesando LO PRIMERO
      await snap.ref.update({
        estado: 'procesando',
        procesandoAt: now,
      })

      // 🔹 Cargar evento
      const eventoRef = db.collection('eventos').doc(eventoId)
      const eventoSnap = await eventoRef.get()

      if (!eventoSnap.exists) {
        throw new Error('evento_inexistente')
      }

      const evento = {
        id: eventoId,
        ...eventoSnap.data(),
      }

      // 🔹 Resolver lote (si aplica)
      let lote = null
      if (Number.isFinite(loteIndice)) {
        if (!Array.isArray(evento.lotes) || !evento.lotes[loteIndice]) {
          throw new Error(`lote_${loteIndice}_inexistente`)
        }
        lote = evento.lotes[loteIndice]

        // 🔻 DESCONTAR CUPOS ANTES DE CREAR
        await descontarCuposArray({
          eventoId,
          loteIndice,
          cantidad: qty,
        })
      }

      // 🎟️ CREAR ENTRADAS (una por una)
      for (let i = 0; i < qty; i++) {
        await crearEntradaBaseAdmin({
          usuarioId,
          usuarioNombre: data.usuarioNombre || '',
          usuarioEmail: data.usuarioEmail || '',
          evento,
          lote,
          loteIndice,
          metodo: 'free',
          precioUnitario: 0,
          estado: 'aprobado',
        })
      }

      // ✅ FINAL OK
      await snap.ref.update({
        estado: 'procesado',
        procesadoAt: now,
      })
    } catch (err) {
      console.error('❌ procesarEntradasGratis error:', err)

      await snap.ref.update({
        estado: 'error',
        error: err.message || 'error_desconocido',
        errorAt: now,
      })
    }
  }
)
