// functions/generarEntradasPagasMercadoPago.js
const crypto = require('crypto')
const { getAdmin } = require('./firebaseAdmin')

// --------------------------------------------------
// 🎟️ GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
async function generarEntradasPagasDesdePago(pagoId, pago) {
  console.log(
    '🎟️ generarEntradasPagasDesdePago INICIO',
    pagoId,
    pago?.itemsSolicitados?.length
  )

  const admin = getAdmin()
  const db = admin.firestore()
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()

  const pagoRef = db.collection('pagos').doc(pagoId)

  // --------------------------------------------------
  // 🔐 LOCK TRANSACCIONAL (IDEMPOTENCIA FUERTE)
  // --------------------------------------------------
  const lockResult = await db.runTransaction(async tx => {
    const snap = await tx.get(pagoRef)

    if (!snap.exists) {
      throw new Error('Pago inexistente')
    }

    const data = snap.data()

    if (data.entradasPagasGeneradas === true) {
      return { yaGeneradas: true }
    }

    if (
      data.entradasPagasGeneradas === 'procesando' &&
      data.entradasPagasLockAt?.toDate
    ) {
      const lockAge = Date.now() - data.entradasPagasLockAt.toDate().getTime()

      if (lockAge < 2 * 60 * 1000) {
        return { locked: true }
      }
    }

    tx.update(pagoRef, {
      entradasPagasGeneradas: 'procesando',
      entradasPagasLockAt: serverTimestamp,
    })

    return { locked: false }
  })

  if (lockResult?.yaGeneradas || lockResult?.locked) {
    console.log('ℹ️ Entradas ya generadas o lock activo', pagoId)
    return
  }

  // --------------------------------------------------
  // VALIDACIÓN
  // --------------------------------------------------
  const { usuarioId, eventoId, itemsSolicitados = [] } = pago

  if (!usuarioId || !eventoId || !Array.isArray(itemsSolicitados)) {
    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: 'Pago inválido',
      entradasPagasErrorAt: serverTimestamp,
    })
    throw new Error('Pago inválido para generar entradas')
  }

  let batch = db.batch()
  let ops = 0

  try {
    for (const item of itemsSolicitados) {
      const cantidad = Number(item.cantidad) || 1
      const precio = Number(item.precio) || 0

      const loteIndice = Number.isFinite(item.loteIndice)
        ? item.loteIndice
        : Number.isFinite(item.index)
        ? item.index
        : null

      for (let i = 0; i < cantidad; i++) {
        const entradaRef = db.collection('entradas').doc()

        const firma = crypto
          .createHash('sha256')
          .update(`${entradaRef.id}|${pagoId}|${eventoId}`)
          .digest('hex')
          .slice(0, 12)

        const qr = `E|${entradaRef.id}|${firma}`

        batch.set(entradaRef, {
          usuarioId,
          eventoId,
          pagoId,

          lote: {
            id: item.lote?.id ?? null,
            nombre: item.nombre ?? 'Entrada',
            precio,
          },
          loteIndice,

          metodo: 'mp',
          precioUnitario: precio,

          estado: 'aprobado',
          aprobadoPor: 'mercadopago',
          usado: false,

          qr,
          creadoEn: serverTimestamp,
        })

        ops++

        if (ops >= 450) {
          await batch.commit()
          batch = db.batch()
          ops = 0
        }
      }
    }

    if (ops > 0) {
      await batch.commit()
    }

    await pagoRef.update({
      entradasPagasGeneradas: true,
      entradasPagasAt: serverTimestamp,
    })

    console.log('✅ Entradas generadas OK', pagoId)
  } catch (err) {
    console.error('❌ Error generando entradas', err)

    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: err.message || 'Error desconocido',
      entradasPagasErrorAt: serverTimestamp,
    })

    throw err
  }
}

module.exports = { generarEntradasPagasDesdePago }
