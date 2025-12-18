import { db } from '../Firebase.js'

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore'

export async function cargarEventos() {
  try {
    const q = query(collection(db, 'eventos'), orderBy('fechaInicio', 'asc'))

    const snap = await getDocs(q)

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }))
  } catch (error) {
    console.error('❌ Error al cargar eventos:', error)
    return []
  }
}

export async function cargarEventoPorId(id) {
  try {
    const ref = doc(db, 'eventos', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null

    return {
      id: snap.id,
      ...snap.data(),
    }
  } catch (error) {
    console.error('❌ Error al cargar evento por ID:', error)
    return null
  }
}

export async function obtenerLotesOrdenados(eventoId) {
  const q = query(
    collection(db, 'eventos', eventoId, 'lotes'),
    orderBy('precio', 'asc') // 🔑 0 primero → gratis
  )

  const snap = await getDocs(q)

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }))
}
