// functions/utils/descontarCuposArray.js

// --------------------------------------------------------------
// functions/utils/descontarCuposArray.js — PASSLINE PRO 2025
// --------------------------------------------------------------
const { getAdmin } = require('../firebaseAdmin')

async function descontarCuposArray({
  eventoId,
  loteIndice,
  cantidad,
  usuarioId,
  compraId, // 🔑 idempotencia (pago / compra / external_reference)
}) {
  if (!eventoId || loteIndice == null || !cantidad || !usuarioId || !compraId) {
    throw new Error('Parámetros inválidos para descontar cupos')
  }

  const admin = getAdmin()
  const db = admin.firestore()

  const eventoRef = db.collection('eventos').doc(eventoId)

  const cupoUsuarioRef = eventoRef
    .collection('cuposUsuarios')
    .doc(`${usuarioId}_${loteIndice}`)

  const descuentoProcesadoRef = eventoRef
    .collection('descuentosProcesados')
    .doc(compraId)

  await db.runTransaction(async tx => {
    // --------------------------------------------------
    // 🔒 Idempotencia total
    // --------------------------------------------------
    const procesadoSnap = await tx.get(descuentoProcesadoRef)
    if (procesadoSnap.exists) return

    // --------------------------------------------------
    // 📦 Evento
    // --------------------------------------------------
    const eventoSnap = await tx.get(eventoRef)
    if (!eventoSnap.exists) {
      throw new Error('Evento inexistente')
    }

    const evento = eventoSnap.data()
    const lotes = Array.isArray(evento.lotes) ? [...evento.lotes] : []

    const lote = lotes[loteIndice]
    if (!lote) {
      throw new Error('Lote inexistente')
    }

    const restantes = Number(lote.cantidad || 0)
    const maxPorUsuario = Number(lote.maxPorUsuario || 0)

    if (restantes < cantidad) {
      throw new Error('Cupos globales insuficientes')
    }

    // --------------------------------------------------
    // 👤 Cupo por usuario (por lote)
    // --------------------------------------------------
    const cupoSnap = await tx.get(cupoUsuarioRef)
    const usados = cupoSnap.exists ? Number(cupoSnap.data().usados) : 0

    if (maxPorUsuario && usados + cantidad > maxPorUsuario) {
      throw new Error(`Supera el máximo por usuario (${maxPorUsuario})`)
    }

    // --------------------------------------------------
    // 🔻 Descontar cupo global
    // --------------------------------------------------
    lote.cantidad = restantes - cantidad
    lotes[loteIndice] = lote
    tx.update(eventoRef, { lotes })

    // --------------------------------------------------
    // 🔻 Registrar uso individual
    // --------------------------------------------------
    tx.set(
      cupoUsuarioRef,
      {
        usuarioId,
        loteIndice,
        usados: usados + cantidad,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    // --------------------------------------------------
    // 🔒 Marcar como procesado
    // --------------------------------------------------
    tx.set(descuentoProcesadoRef, {
      compraId,
      eventoId,
      loteIndice,
      cantidad,
      usuarioId,
      procesadoEn: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
}

module.exports = { descontarCuposArray }
