// --------------------------------------------------------------
// src/services/expiracionPedidos.js — FINAL PRO
// --------------------------------------------------------------

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'

import { db } from '../Firebase.js'
import { devolverStock } from './comprasService.js'

export async function expirarPedidosVencidos() {
  const ahora = Timestamp.now()

  const q = query(
    collection(db, 'compras'),
    where('estado', '==', 'pendiente'),
    where('expiraEn', '<=', ahora)
  )

  const snap = await getDocs(q)

  if (snap.empty) return 0

  for (const snapDoc of snap.docs) {
    const pedido = snapDoc.data()

    // 🔄 devolver stock
    if (pedido.items?.length) {
      await devolverStock(pedido.items)
    }

    // ⛔ marcar expirado
    await updateDoc(doc(db, 'compras', snapDoc.id), {
      estado: 'expirado',
      expiraEn: null,
    })
  }

  return snap.size
}
