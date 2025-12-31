import admin from 'firebase-admin'

export function getAdmin() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 missing')
    }

    const serviceAccount = JSON.parse(
      Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        'base64'
      ).toString('utf8')
    )

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }

  return admin
}
