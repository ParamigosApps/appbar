import { db } from '../Firebase.js'

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

export function escucharEntradasPendientes(callback) {
  return onSnapshot(collection(db, 'entradasPendientes'), snap => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(lista)
  })
}

export async function aprobarEntrada(entrada) {
  try {
    const entradaAprobada = {
      ...entrada,
      estado: 'aprobada',
      aprobadoEn: serverTimestamp(),
      pagado: entrada.pagado ?? false,
      usado: false,
    }
    await setDoc(doc(db, 'entradas', entrada.id), entradaAprobada)
    await deleteDoc(doc(db, 'entradasPendientes', entrada.id))
    return true
  } catch (err) {
    console.error('❌ Error al aprobar entrada:', err)
    return false
  }
}

export async function rechazarEntrada(id) {
  try {
    await deleteDoc(doc(db, 'entradasPendientes', id))
    return true
  } catch (err) {
    console.error('❌ Error al rechazar entrada:', err)
    return false
  }
}

export async function marcarComoPagada(id, enPendientes = true) {
  try {
    const coleccion = enPendientes ? 'entradasPendientes' : 'entradas'
    await updateDoc(doc(db, coleccion, id), { pagado: true })
    return true
  } catch (err) {
    console.error('❌ Error al marcar como pagada:', err)
    return false
  }
}
