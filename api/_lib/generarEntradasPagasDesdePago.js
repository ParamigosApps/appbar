import admin from 'firebase-admin'
import crypto from 'crypto'

const db = admin.firestore()
const { serverTimestamp } = admin.firestore.FieldValue

// --------------------------------------------------
// 🔥 GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
export async function generarEntradasPagasDesdePago(pagoId, pago) {
  // 🔐 Idempotencia dura
  if (pago.entradasPagasGeneradas === true) return

  const batch = db.batch()

  const { usuarioId, eventoId, itemsPagados = [] } = pago

  if (!usuarioId || !eventoId || !Array.isArray(itemsPagados)) {
    throw new Error('Pago inválido para generar entradas')
  }

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

      // 🔐 Firma QR (simple, robusta)
      const firma = crypto
        .createHash('sha256')
        .update(entradaRef.id)
        .digest('hex')
        .slice(0, 10)

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
          precio: precio,
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
    }
  }

  // 🔒 Marcar pago como procesado
  batch.update(db.collection('pagos').doc(pagoId), {
    entradasPagasGeneradas: true,
    entradasPagasAt: serverTimestamp(),
  })

  await batch.commit()
}
