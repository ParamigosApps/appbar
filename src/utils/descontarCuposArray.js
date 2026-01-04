// functions/utils/descontarCuposArray.js
const { getAdmin } = require('../firebaseAdmin')

/**
 * 🔻 Descuenta cupos reales de un lote dentro del array eventos.lotes[]
 * @param {string} eventoId
 * @param {number} loteIndice
 * @param {number} cantidad
 */
async function descontarCuposArray({ eventoId, loteIndice, cantidad }) {
  if (
    !eventoId ||
    loteIndice === null ||
    loteIndice === undefined ||
    !cantidad
  ) {
    throw new Error('Parámetros inválidos para descontar cupos')
  }

  const admin = getAdmin()
  const db = admin.firestore()

  const eventoRef = db.collection('eventos').doc(eventoId)

  await db.runTransaction(async tx => {
    const snap = await tx.get(eventoRef)
    if (!snap.exists) {
      throw new Error('Evento inexistente')
    }

    const data = snap.data()
    const lotes = Array.isArray(data.lotes) ? [...data.lotes] : []

    if (!lotes[loteIndice]) {
      throw new Error(`Lote índice ${loteIndice} inexistente`)
    }

    const lote = { ...lotes[loteIndice] }

    const restantes = Number(lote.cantidad) ?? Number(lote.restantes) ?? 0

    if (restantes < cantidad) {
      throw new Error(
        `Cupos insuficientes: quedan ${restantes}, se pidieron ${cantidad}`
      )
    }

    // 🔻 DESCUENTO REAL
    lote.cantidad = restantes - cantidad

    lotes[loteIndice] = lote

    tx.update(eventoRef, { lotes })
  })
}

module.exports = { descontarCuposArray }
