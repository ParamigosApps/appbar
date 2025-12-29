import admin from 'firebase-admin'
import crypto from 'crypto'

const db = admin.firestore()
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp

// --------------------------------------------------
// 🔥 GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
export async function generarEntradasPagasDesdePago(pagoId, pago) {
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

    // Ya generado → salir silenciosamente
    if (data.entradasPagasGeneradas === true) {
      return { yaGeneradas: true }
    }

    // Lock activo pero viejo → permitir reintento
    if (
      data.entradasPagasGeneradas === 'procesando' &&
      data.entradasPagasLockAt?.toDate
    ) {
      const lockAge = Date.now() - data.entradasPagasLockAt.toDate().getTime()

      // 2 minutos de timeout
      if (lockAge < 2 * 60 * 1000) {
        return { locked: true }
      }
    }

    tx.update(pagoRef, {
      entradasPagasGeneradas: 'procesando',
      entradasPagasLockAt: serverTimestamp(),
    })

    return { locked: false }
  })

  if (lockResult?.yaGeneradas) return
  if (lockResult?.locked) return

  // --------------------------------------------------
  // VALIDACIÓN DE DATOS
  // --------------------------------------------------
  const { usuarioId, eventoId, itemsPagados = [] } = pago

  if (!usuarioId || !eventoId || !Array.isArray(itemsPagados)) {
    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: 'Pago inválido para generar entradas',
      entradasPagasErrorAt: serverTimestamp(),
    })
    throw new Error('Pago inválido para generar entradas')
  }

  let batch = db.batch()
  let operaciones = 0

  try {
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

        // 🔐 FIRMA QR ANTIFRAUDE
        const firma = crypto
          .createHash('sha256')
          .update(`${entradaRef.id}|${pagoId}|${eventoId}`)
          .digest('hex')
          .slice(0, 12)

        const qrData = `E|${entradaRef.id}|${firma}`

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

          estado: 'aprobada',
          aprobadoPor: 'mercadopago',
          usado: false,

          qr: qrData,

          creadoEn: serverTimestamp(),
        })

        operaciones++

        if (operaciones >= 450) {
          await batch.commit()
          batch = db.batch()
          operaciones = 0
        }
      }
    }

    if (operaciones > 0) {
      await batch.commit()
    }

    // --------------------------------------------------
    // ✅ FINALIZAR
    // --------------------------------------------------
    await pagoRef.update({
      entradasPagasGeneradas: true,
      entradasPagasAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('❌ Error generando entradas:', err)

    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: err.message || 'Error desconocido',
      entradasPagasErrorAt: serverTimestamp(),
    })

    throw err
  }
}
