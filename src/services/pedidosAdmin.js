// --------------------------------------------------------------
// src/services/pedidosAdmin.js
// --------------------------------------------------------------
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../Firebase.js'

// ======================================================
// 🔄 ESCUCHAR COMPRAS PENDIENTES (tiempo real)
// Igual a tu lógica original con pedidos.js
// ======================================================
export function escucharComprasPendientes(setLista) {
  const ref = collection(db, 'comprasPendientes')

  const unsub = onSnapshot(ref, snap => {
    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }))
    setLista(data)
  })

  return unsub
}

// ======================================================
// ✔ APROBAR COMPRA
// Mueve de "comprasPendientes" → "compras"
// ======================================================
export async function aprobarCompra(compra) {
  try {
    await addDoc(collection(db, 'compras'), {
      ...compra,
      pagado: compra.pagado ?? false,
    })

    await deleteDoc(doc(db, 'comprasPendientes', compra.id))

    return true
  } catch (err) {
    console.error('❌ Error al aprobar compra:', err)
    return false
  }
}

// ======================================================
// ❌ RECHAZAR COMPRA (eliminar pendiente)
// ======================================================
export async function rechazarCompra(id) {
  try {
    await deleteDoc(doc(db, 'comprasPendientes', id))
    return true
  } catch (err) {
    console.error('❌ Error al rechazar compra:', err)
    return false
  }
}

// ======================================================
// 💰 MARCAR COMPRA COMO PAGADA
// Actualiza el campo pagado en "compras"
// ======================================================
export async function marcarCompraPagada(id, estado = true) {
  try {
    const ref = doc(db, 'compras', id)
    const snap = await getDoc(ref)

    if (!snap.exists()) return false

    await updateDoc(ref, { pagado: estado })
    return true
  } catch (err) {
    console.error('❌ Error marcando como pagada:', err)
    return false
  }
}

// ======================================================
// 🔍 OBTENER PEDIDOS POR ESTADO
// (faltaba esta función → rompe CarritoContext)
// ======================================================
export async function obtenerPedidosPorEstado(usuarioId, estado) {
  try {
    const q = query(
      collection(db, 'compras'),
      where('usuarioId', '==', usuarioId),
      where('estado', '==', estado)
    )

    const snap = await getDocs(q)
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('❌ Error en obtenerPedidosPorEstado:', err)
    return []
  }
}
