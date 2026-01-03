import admin from 'firebase-admin'

console.log('🔥 [firebaseAdmin] módulo cargado')

const projectId = process.env.FIREBASE_PROJECT_ID

console.log('🔧 [firebaseAdmin] ENV FIREBASE_PROJECT_ID:', projectId)

if (!projectId) {
  console.error('❌ [firebaseAdmin] FIREBASE_PROJECT_ID NO DEFINIDO')
}

if (!admin.apps.length) {
  try {
    console.log('🚀 [firebaseAdmin] initializeApp START')

    admin.initializeApp({
      projectId,
    })

    console.log('✅ [firebaseAdmin] initializeApp OK')
    console.log(
      '📦 [firebaseAdmin] apps:',
      admin.apps.map(a => a.name)
    )
  } catch (err) {
    console.error('💥 [firebaseAdmin] initializeApp ERROR', err)
  }
} else {
  console.log('ℹ️ [firebaseAdmin] app ya inicializada')
}

export function getAdmin() {
  console.log('📡 [firebaseAdmin] getAdmin() llamado')

  try {
    const db = admin.firestore()
    console.log('✅ [firebaseAdmin] firestore() OK')
    return admin
  } catch (err) {
    console.error('💥 [firebaseAdmin] firestore() ERROR', err)
    throw err
  }
}
