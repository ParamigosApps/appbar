import admin from 'firebase-admin'
import fs from 'fs'

// 👉 Cargá tu service account
const serviceAccount = JSON.parse(
  fs.readFileSync('./serviceAccount.json', 'utf8')
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

async function run() {
  const uid = 'skbVlt0ma5bJneMbcyFa7Ypl9Cd2'

  await admin.auth().setCustomUserClaims(uid, {
    admin: true,
  })

  console.log('✅ ADMIN asignado correctamente al UID:', uid)
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Error asignando admin:', err)
  process.exit(1)
})
