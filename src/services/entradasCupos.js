import { doc, updateDoc, increment } from 'firebase/firestore'
import { db } from '../../Firebase.js'

export async function liberarCuposGratis({
  eventoId,
  entradasGratisPendientes = [],
}) {
  if (!eventoId || !entradasGratisPendientes.length) return

  for (const g of entradasGratisPendientes) {
    const ref = doc(db, 'eventos', eventoId, 'lotes', g.lote.id)

    await updateDoc(ref, {
      restantes: increment(g.cantidad),
    })
  }
}
