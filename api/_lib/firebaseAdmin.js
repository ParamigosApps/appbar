import admin from 'firebase-admin'

let app

export function getAdmin() {
  if (app) return admin

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (!base64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 missing')
  }

  let serviceAccount
  try {
    const json = Buffer.from(base64, 'base64').toString('utf8')
    serviceAccount = JSON.parse(json)
  } catch (err) {
    console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_BASE64')
    throw err
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  return admin
}
