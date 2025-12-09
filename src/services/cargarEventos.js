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
    const q = query(collection(db, 'eventos'), orderBy('fecha', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
    return { id: snap.id, ...snap.data() }
  } catch (error) {
    console.error('❌ Error al cargar evento por ID:', error)
    return null
  }
}
