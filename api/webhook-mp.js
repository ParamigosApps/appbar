// /api/webhook-mp.js
import crypto from 'crypto'
import { getAdmin } from './_lib/firebaseAdmin.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false },
}

// --------------------------------------------------
// Leer body crudo
// --------------------------------------------------
function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// --------------------------------------------------
// Verificar firma MP (opcional)
// --------------------------------------------------
function verifySignature(req, raw, secret) {
  if (!secret) return true

  const sig = req.headers['x-signature']
  if (!sig) return false

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')

  return sig === expected
}

// --------------------------------------------------
// Handler principal
// --------------------------------------------------
export default async function handler(req, res) {
  console.log('🔥 WEBHOOK MP HIT')
  console.log('➡️ method:', req.method)
  console.log('➡️ query:', req.query)

  if (req.method !== 'POST') {
    return res.status(200).end('ignored')
  }

  let raw = ''
  try {
    raw = await readRaw(req)
  } catch (e) {
    console.error('❌ error leyendo raw body', e)
    return res.status(200).end('read_error')
  }

  console.log('📦 RAW BODY:', raw)

  // ⚠️ responder SIEMPRE 200 inmediato a MP
  res.status(200).json({ ok: true })

  const MPWEBHOOKSECRET = process.env.MPWEBHOOKSECRET
  if (!verifySignature(req, raw, MPWEBHOOKSECRET)) {
    console.error('❌ firma inválida')
    return
  }

  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch (e) {
    console.error('❌ JSON inválido', e)
    return
  }

  console.log('🧩 BODY PARSEADO:', body)

  // --------------------------------------------------
  // Normalizar evento Mercado Pago
  // --------------------------------------------------
  const topic =
    body.type || body.topic || req.query?.type || req.query?.topic || null

  const refId =
    body?.data?.id ||
    body?.id ||
    req.query?.['data.id'] ||
    req.query?.id ||
    null

  console.log('🔎 topic:', topic)
  console.log('🔎 refId:', refId)

  if (!topic || !refId) {
    console.log('ℹ️ evento ignorado (sin topic o id)')
    return
  }

  if (!['payment', 'merchant_order'].includes(topic)) {
    console.log('ℹ️ topic no manejado:', topic)
    return
  }

  // --------------------------------------------------
  // 🔑 DOC ID CORRECTO SEGÚN TOPIC
  // --------------------------------------------------
  const docId = topic === 'payment' ? `payment_${refId}` : `order_${refId}`

  console.log('🧾 docId:', docId)

  // --------------------------------------------------
  // Firestore
  // --------------------------------------------------
  try {
    const admin = getAdmin()
    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const ref = db.collection('webhook_events').doc(docId)

    await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      if (snap.exists) {
        console.log('ℹ️ webhook ya registrado, se ignora')
        return
      }

      tx.set(ref, {
        topic,
        refId, // paymentId o merchantOrderId
        receivedAt: now,
        rawBodyLen: raw.length,
        xRequestId: req.headers['x-request-id'] || null,
        processed: false,
      })
    })

    console.log('✅ webhook_events creado:', docId)
  } catch (e) {
    console.error('❌ error escribiendo Firestore', e)
  }
}
