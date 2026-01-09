// /api/webhook-mp.js

import crypto from 'crypto'
import { getAdmin } from './_lib/firebaseAdmin.js'
export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false },
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function verifySignature(req, raw, secret) {
  if (!secret) return true
  const sig = req.headers['x-signature']
  if (!sig) return false
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return sig === expected
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end('ignored')
  }

  let raw = ''
  try {
    raw = await readRaw(req)
  } catch (e) {
    console.error('❌ error leyendo raw body', e)
    return res.status(200).json({ ok: false, error: 'read_error' })
  }

  console.log('📦 RAW BODY:', raw)

  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch (e) {
    console.error('❌ JSON inválido', e)
    return res.status(200).json({ ok: false, error: 'json_invalid' })
  }

  console.log('🧩 BODY PARSEADO:', body)

  const MPWEBHOOKSECRET = process.env.MPWEBHOOKSECRET
  if (!verifySignature(req, raw, MPWEBHOOKSECRET)) {
    console.error('❌ firma inválida')
    return res.status(200).json({ ok: false, error: 'bad_signature' })
  }

  let topic =
    body.type ||
    body.topic ||
    (typeof body.action === 'string'
      ? body.action.split('.')[0] // "payment.updated" → "payment"
      : null) ||
    req.query?.topic ||
    req.query?.type ||
    null
  console.log('🧠 topic normalizado:', topic)
  const refId =
    body?.data?.id ||
    body?.data?.payment_id ||
    body?.id ||
    req.query?.id ||
    req.query?.['data.id'] ||
    null

  console.log('🔎 topic:', topic)
  console.log('🔎 refId:', refId)

  if (!topic || !refId) {
    console.log('ℹ️ evento ignorado (sin topic o id)')
    return res.status(200).json({ ok: true, ignored: true })
  }

  if (!['payment', 'merchant_order'].includes(topic)) {
    console.log('ℹ️ topic no manejado:', topic)
    return res.status(200).json({ ok: true, ignored: true })
  }

  const docId = topic === 'payment' ? `payment_${refId}` : `order_${refId}`

  console.log('🧾 docId:', docId)

  try {
    console.log('📡 [firebaseAdmin] getAdmin() llamado')
    const admin = getAdmin()
    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    console.log('🧪 [webhook] transaction START', {
      collection: 'webhook_events',
      docId,
      projectId: process.env.FIREBASE_PROJECT_ID,
    })

    const ref = db.collection('webhook_events').doc(docId)

    await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      console.log('🧪 [webhook] tx.get exists?', snap.exists)

      if (snap.exists) {
        console.log('ℹ️ webhook ya registrado, se ignora')
        return
      }

      tx.set(ref, {
        topic,
        refId,
        receivedAt: now,
        rawBodyLen: raw.length,
        xRequestId: req.headers['x-request-id'] || null,
        processed: false,
      })
    })

    if (topic === 'payment') {
      console.log('💳 procesando payment', refId)

      const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
      if (!MP_ACCESS_TOKEN) {
        console.error('❌ MP_ACCESS_TOKEN faltante')
        return res.status(200).json({ ok: false })
      }

      // 1️⃣ obtener payment real desde MP
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${refId}`,
        {
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          },
        }
      )

      if (!mpRes.ok) {
        console.error('❌ error consultando MP', mpRes.status)
        return res.status(200).json({ ok: false })
      }

      const payment = await mpRes.json()

      console.log('📄 payment MP:', {
        id: payment.id,
        status: payment.status,
        detail: payment.status_detail,
        external_reference: payment.external_reference,
      })

      const pagoId = payment.external_reference
      if (!pagoId) {
        console.log('ℹ️ payment sin external_reference')
        return res.status(200).json({ ok: true })
      }

      // 2️⃣ buscar pago en Firestore
      const pagoRef = db.collection('pagos').doc(pagoId)
      const pagoSnap = await pagoRef.get()

      if (!pagoSnap.exists) {
        console.log('ℹ️ pago no existe en Firestore', pagoId)
        return res.status(200).json({ ok: true })
      }

      const pago = pagoSnap.data()

      // 3️⃣ actualizar pago (SIEMPRE)
      await pagoRef.update({
        estado:
          payment.status === 'approved'
            ? 'pagado'
            : payment.status === 'rejected' || payment.status === 'cancelled'
            ? 'rechazado'
            : 'pendiente',

        mpStatus: payment.status,
        mpStatusDetail: payment.status_detail || null,
        processed: true,
        updatedAt: now,
      })

      // --------------------------------------------------
      // 4️⃣ ENTRADAS PAGAS (ORQUESTACIÓN)
      // --------------------------------------------------
      if (pago.tipo === 'compra') {
        console.log('🛒 pago tipo compra → marcar compra')

        if (payment.status !== 'approved') {
          console.log('ℹ️ compra no aprobada según MP, skip', {
            pagoId,
            mpStatus: payment.status,
          })
        }
      }
    }
    await ref.update({
      processed: true,
      processedAt: now,
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('❌ error escribiendo Firestore', e)
    return res.status(200).json({ ok: false, error: 'firestore_error' })
  }
}
