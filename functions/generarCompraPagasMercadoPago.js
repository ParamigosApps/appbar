// functions/generarCompraPagasMercadoPago.js
const { getAdmin } = require('./firebaseAdmin')

// --------------------------------------------------
// 🛒 MARCAR COMPRA COMO PAGADA DESDE MP
// --------------------------------------------------
async function marcarCompraPagadaDesdePago({ pagoId, compraId, payment }) {
  const admin = getAdmin()
  const db = admin.firestore()
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()

  if (!payment?.status) {
    throw new Error('Payment inválido')
  }
  if (!compraId) {
    console.error('❌ compraId faltante para pago', pagoId)
    return
  }
  console.log('🛒 marcarCompraPagadaDesdePago EJECUTANDO', {
    pagoId,
    compraId,
    mpStatus: payment.status,
  })

  const compraRef = db.collection('compras').doc(compraId)
  const compraSnap = await compraRef.get()

  if (!compraSnap.exists) {
    console.error('❌ Compra inexistente', compraId, 'pago', pagoId)
    return
  }

  // --------------------------------------------------
  // 🔐 LOCK TRANSACCIONAL (IDEMPOTENCIA)
  // --------------------------------------------------
  const lock = await db.runTransaction(async tx => {
    const snap = await tx.get(compraRef)

    if (!snap.exists) throw new Error('Compra inexistente')

    const data = snap.data()

    if (data.pagado === true) {
      return { yaProcesada: true }
    }

    if (data.compraPagoProcesando === true && data.compraPagoLockAt?.toDate) {
      const age = Date.now() - data.compraPagoLockAt.toDate().getTime()
      if (age < 2 * 60 * 1000) return { locked: true }
    }

    tx.update(compraRef, {
      compraPagoProcesando: true,
      compraPagoLockAt: serverTimestamp,
    })

    return { locked: false }
  })

  if (lock?.yaProcesada || lock?.locked) {
    console.log('ℹ️ Compra ya procesada o lock activo', pagoId)
    return
  }

  // --------------------------------------------------
  // 🧠 Resolver estado MP → estado compra
  // --------------------------------------------------
  let nuevoEstado = 'pendiente'
  let pagado = false

  if (payment.status === 'approved') {
    nuevoEstado = 'aprobado'
    pagado = true
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    nuevoEstado = 'rechazado'
    pagado = false
  }

  // --------------------------------------------------
  // 📝 Update final
  // --------------------------------------------------
  await compraRef.update({
    // 🔑 estado de negocio
    estado: pagado ? 'aprobado' : nuevoEstado,
    pagado: pagado,

    // 🔗 vínculo de pago
    pagoId,
    metodo: 'mp',
    origenPago: 'mp',

    // 🕒 timestamps estándar de la app
    updatedAt: serverTimestamp,
    paymentApprovedAt: pagado ? serverTimestamp : null,

    // 🧹 limpieza de locks
    compraPagoProcesando: false,
    compraPagoProcesadoAt: serverTimestamp,
  })

  console.log('✅ Compra actualizada', pagoId, nuevoEstado)
}

module.exports = { marcarCompraPagadaDesdePago }
