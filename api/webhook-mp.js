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
  if (req.method !== 'POST') return res.status(200).end()

  const raw = await readRaw(req)

  // responder inmediato a MP
  res.status(200).json({ ok: true })

  const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
  if (!verifySignature(req, raw, MP_WEBHOOK_SECRET)) return

  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return
  }

  const topic = body.type || body.topic
  const paymentId = body?.data?.id || req.query?.['data.id']

  if (topic !== 'payment' || !paymentId) return

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  const ref = db.collection('webhook_events').doc(`payment_${paymentId}`)

  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      if (snap.exists) return
      tx.set(ref, {
        topic,
        paymentId,
        receivedAt: now,
        processed: false,
      })
    })
  } catch (error) {
    console.error('❌ Error saving webhook event:', error)
  }
}
