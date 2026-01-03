// /api/webhook-mp.js
import crypto from 'crypto'
import { getAdmin } from './_lib/firebaseAdmin.js'

export const config = { runtime: 'nodejs', api: { bodyParser: false } }

function readRaw(req) {
  return new Promise((res, rej) => {
    let d = ''
    req.on('data', c => (d += c))
    req.on('end', () => res(d))
    req.on('error', rej)
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
  res.status(200).json({ ok: true }) // responder inmediato a MP

  const MPWEBHOOKSECRET = process.env.MPWEBHOOKSECRET
  if (!verifySignature(req, raw, MPWEBHOOKSECRET)) return

  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return
  }

  const topic = body.type || body.topic || req.query?.type || req.query?.topic
  const action = body.action || null
  const paymentId = body?.data?.id || req.query?.['data.id'] || req.query?.id

  if (topic !== 'payment' || !paymentId) return

  const admin = getAdmin()
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  const ref = db.collection('webhook_events').doc(`payment_${paymentId}`)

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref)
    if (snap.exists) return

    tx.set(ref, {
      topic,
      action,
      paymentId,
      x_request_id: req.headers['x-request-id'] || null,
      x_signature: req.headers['x-signature'] || null,
      rawbodylen: raw.length,
      receivedAt: now,
      processed: false,
    })
  })
}
