// functions/utils/descontarCuposArray.js
const { getAdmin } = require('../firebaseAdmin')

async function descontarCuposArray({
  eventoId,
  loteIndice,
  cantidad,
  usuarioId,
}) {
  if (!eventoId || loteIndice == null || !cantidad || !usuarioId) {
    throw new Error('Parámetros inválidos para descontar cupos')
  }

  const admin = getAdmin()
  const db = admin.firestore()

  const eventoRef = db.collection('eventos').doc(eventoId)
  const cupoUsuarioRef = db
    .collection('eventos')
    .doc(eventoId)
    .collection('cuposUsuarios')
    .doc(`${usuarioId}_${loteIndice}`)

  await db.runTransaction(async tx => {
    const eventoSnap = await tx.get(eventoRef)
    if (!eventoSnap.exists) throw new Error('Evento inexistente')

    const evento = eventoSnap.data()
    const lotes = Array.isArray(evento.lotes) ? [...evento.lotes] : []

    const lote = lotes[loteIndice]
    if (!lote) throw new Error('Lote inexistente')

    const maxPorUsuario = Number(lote.maxPorUsuario || 0)
    const restantes = Number(lote.cantidad || 0)

    if (restantes < cantidad) {
      throw new Error('Cupos globales insuficientes')
    }

    const cupoSnap = await tx.get(cupoUsuarioRef)
    const usados = cupoSnap.exists ? Number(cupoSnap.data().usados) : 0

    if (maxPorUsuario && usados + cantidad > maxPorUsuario) {
      throw new Error(`Supera el máximo por usuario (${maxPorUsuario})`)
    }

    // 🔻 descontar cupo global
    lote.cantidad = restantes - cantidad
    lotes[loteIndice] = lote

    tx.update(eventoRef, { lotes })

    // 🔻 registrar cupo individual
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
  })
}

module.exports = { descontarCuposArray }
