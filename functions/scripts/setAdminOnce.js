const { getAdmin } = require('../firebaseAdmin')

async function run() {
  const admin = getAdmin()

  const UID = 'skbVlt0ma5bJneMbcyFa7Ypl9Cd2'

  await admin.auth().setCustomUserClaims(UID, {
    admin: true,
  })

  console.log('✅ Claim admin asignado a:', UID)
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Error asignando claim:', err)
  process.exit(1)
})
