import crypto from 'crypto'
import { getAdmin } from './firebaseAdmin.js'

// --------------------------------------------------
// 🔥 GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
export async function generarEntradasPagasDesdePago(pagoId, pago) {
  // ----------------------------------------------
  // INIT FIREBASE (SEGURO EN SERVERLESS)
  // ----------------------------------------------
  console.log(
    '🎟️ generarEntradasPagasDesdePago INICIO',
    pagoId,
    pago?.itemsSolicitados?.length
  )
  const admin = getAdmin()
  const db = admin.firestore()
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp

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
  const { usuarioId, eventoId, itemsSolicitados = [] } = pago

  if (!usuarioId || !eventoId || !Array.isArray(itemsSolicitados)) {
    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: 'Pago inválido para generar entradas',
      entradasPagasErrorAt: serverTimestamp(),
    })
    throw new Error('Pago inválido para generar entradas')
  }

  let batch = db.batch()
  let operaciones = 0

  console.log('📦 itemsSolicitados:', JSON.stringify(itemsSolicitados))

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

          estado: 'aprobado',
          aprobadoPor: 'mercadopago',
          usado: false,

          qr: qrData,

          creadoEn: serverTimestamp(),
        })

        operaciones++

        // Firestore límite ~500 operaciones
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
    console.log('Entradas antes de dar el paso final')

    // --------------------------------------------------
    // ✅ FINALIZAR
    // --------------------------------------------------
    await pagoRef.update({
      entradasPagasGeneradas: true,
      entradasPagasAt: serverTimestamp(),
    })
    console.log('✅ Entradas generadas OK para pago', pagoId)
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
