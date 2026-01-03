// testWebhook.cjs
const admin = require('firebase-admin')

// Usa Application Default Credentials (NO service account JSON)
admin.initializeApp()

const db = admin.firestore()

async function run() {
  const id = `payment_test_${Date.now()}`

  await db.collection('webhook_events').doc(id).set({
    topic: 'payment',
    refId: '140535874438', // podés cambiarlo si querés
    processed: false,
    retryCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'manual_test',
  })

  console.log('🔥 Webhook disparado correctamente:', id)
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Error disparando webhook', err)
  process.exit(1)
})
