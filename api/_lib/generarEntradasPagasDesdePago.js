import admin from 'firebase-admin'
import crypto from 'crypto'

const db = admin.firestore()
const { serverTimestamp } = admin.firestore.FieldValue

// --------------------------------------------------
// 🔥 GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
export async function generarEntradasPagasDesdePago(pagoId, pago) {
  const pagoRef = db.collection('pagos').doc(pagoId)

  // 🔐 Idempotencia FUERTE (lock transaccional)
  await db.runTransaction(async tx => {
    const snap = await tx.get(pagoRef)

    if (!snap.exists) {
      throw new Error('Pago inexistente')
    }

    const data = snap.data()

    if (data.entradasPagasGeneradas === true) {
      throw new Error('ENTRADAS_YA_GENERADAS')
    }

    tx.update(pagoRef, {
      entradasPagasGeneradas: 'procesando',
      entradasPagasLockAt: serverTimestamp(),
    })
  })

  const { usuarioId, eventoId, itemsPagados = [] } = pago

  if (!usuarioId || !eventoId || !Array.isArray(itemsPagados)) {
    throw new Error('Pago inválido para generar entradas')
  }

  let batch = db.batch()
  let operaciones = 0

  for (const item of itemsPagados) {
    const cantidad = Number(item.cantidad) || 1
    const precio = Number(item.precio) || 0

    const loteIndice = Number.isFinite(item.loteIndice)
      ? item.loteIndice
      : Number.isFinite(item.index)
      ? item.index
      : null

    for (let i = 0; i < cantidad; i++) {
      const entradaRef = db.collection('entradas').doc()

      // 🔐 Firma QR REAL (antifraude)
      const firma = crypto
        .createHash('sha256')
        .update(`${entradaRef.id}|${pagoId}|${eventoId}`)
        .digest('hex')
        .slice(0, 12)

      const qrData = `E|${entradaRef.id}|${firma}`

      batch.set(entradaRef, {
        // -----------------------------
        // RELACIONES
        // -----------------------------
        usuarioId,
        eventoId,
        pagoId,

        // -----------------------------
        // LOTE
        // -----------------------------
        lote: {
          id: item.lote?.id ?? null,
          nombre: item.nombre ?? 'Entrada',
          precio,
        },
        loteIndice,

        // -----------------------------
        // ECONOMÍA
        // -----------------------------
        metodo: 'mp',
        precioUnitario: precio,

        // -----------------------------
        // ESTADO
        // -----------------------------
        estado: 'aprobada',
        aprobadoPor: 'mercadopago',
        usado: false,

        // -----------------------------
        // QR
        // -----------------------------
        qr: qrData,

        // -----------------------------
        // METADATA
        // -----------------------------
        creadoEn: serverTimestamp(),
      })

      operaciones++

      // 🔒 Commit parcial si se acerca al límite
      if (operaciones >= 450) {
        await batch.commit()
        batch = db.batch()
        operaciones = 0
      }
    }
  }

  // Último commit
  if (operaciones > 0) {
    await batch.commit()
  }

  // 🔒 Marcar pago como FINALIZADO
  await pagoRef.update({
    entradasPagasGeneradas: true,
    entradasPagasAt: serverTimestamp(),
  })
}
