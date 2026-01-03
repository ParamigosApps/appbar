// /api/_lib/firebaseAdmin.js
import admin from 'firebase-admin'

console.log('🔥 [firebaseAdmin] módulo cargado')

let app

export function getAdmin() {
  if (app) {
    console.log('♻️ [firebaseAdmin] usando app existente')
    return admin
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64

  if (!b64) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 NO DEFINIDA')
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64')
  }

  console.log('🔐 [firebaseAdmin] decodificando service account')

  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  console.log('✅ [firebaseAdmin] initializeApp OK')
  console.log(
    '📦 apps:',
    admin.apps.map(a => a.name)
  )

  return admin
}
