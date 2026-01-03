// api/_lib/firebaseAdmin.js
import admin from 'firebase-admin'

let app

export function getAdmin() {
  if (app) return admin

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 missing')
  }

  let json
  try {
    json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch (e) {
    console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_BASE64')
    throw e
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(json),
  })

  return admin
}
