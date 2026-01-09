/**
 * Simula un pago MP aprobado usando el modo TEST_
 * Ejecutar con: node simularPagoMP.js
 */

import admin from 'firebase-admin'
import fs from 'fs'
const serviceAccount = JSON.parse(fs.readFileSync(new URL('../serviceAccount.json', import.meta.url)))

// 🔧 CONFIGURAR
const EVENTO_ID = 'ID_DEL_EVENTO'
const USUARIO_ID = 'UID_DE_PRUEBA'
const LOTE_INDICE = 0
const CANTIDAD = 2
const PRECIO = 1

const PAGO_ID = `TEST_PAGO_${Date.now()}`

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

async function run() {
  console.log('▶️ Creando pago:', PAGO_ID)

  // 1️⃣ Crear pago
  await db
    .collection('pagos')
    .doc(PAGO_ID)
    .set({
      tipo: 'entrada',
      metodo: 'mp',
      estado: 'pendiente',

      usuarioId: USUARIO_ID,
      usuarioNombre: 'Test User',
      usuarioEmail: 'test@test.com',

      eventoId: EVENTO_ID,

      itemsSolicitados: [
        {
          nombre: 'General lote 1',
          cantidad: CANTIDAD,
          precio: PRECIO,
          loteIndice: LOTE_INDICE,
        },
      ],

      total: CANTIDAD * PRECIO,
      entradasPagasGeneradas: false,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

  // 2️⃣ Crear webhook_event (dispara el flujo)
  console.log('▶️ Creando webhook_event')

  await db.collection('webhook_events').add({
    topic: 'payment',
    refId: PAGO_ID,
    processed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  console.log('✅ Simulación enviada')
  console.log('👉 Revisar logs de Functions')
}

run().catch(err => {
  console.error('❌ Error simulando pago', err)
  process.exit(1)
})
