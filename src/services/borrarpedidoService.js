// --------------------------------------------------------------
// src/services/pedidosService.js — VERSIÓN COMPLETA REACT
// Copia fiel del sistema original (compras + comprasPendientes)
// --------------------------------------------------------------

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'

import { db, auth } from '../context/FirebaseContext.jsx'
import { generarCompraQr } from './generarQrService.js'

// ======================================================
// 📌 FORMATEAR FECHA EXACTO A TU VERSIÓN ORIGINAL
// ======================================================
export function formatearFechaPedido(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')

  return `${dd}/${mm}/${yyyy} - ${hh}:${mi} hs`
}

// ======================================================
// 📌 CREAR PEDIDO (pendiente o pagado)
// ======================================================
export async function crearPedido({
  carrito,
  total,
  pagado = false,
  lugar = 'Tienda',
}) {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('Usuario no autenticado')

    const fechaHumana = formatearFechaPedido(new Date())

    const coleccion = pagado ? 'compras' : 'comprasPendientes'

    const docRef = await addDoc(collection(db, coleccion), {
      usuarioId: user.uid,
      usuarioNombre: user.displayName || user.email || 'Usuario',
      items: carrito,
      total,
      pagado,
      estado: pagado ? 'pagado' : 'pendiente',
      lugar,
      fecha: serverTimestamp(),
      creadoEn: serverTimestamp(),
      fechaHumana,
      ticketId: Date.now() + '-' + Math.floor(Math.random() * 9999),
      usado: false,
    })

    // 👉 Generar QR igual que antes
    await generarCompraQr({
      compraId: docRef.id,
      total,
      usuario: user.email || 'Usuario',
      fecha: fechaHumana,
      productos: carrito,
    })
    cacadasdasdsa
    return { ok: true, id: docRef.id }
  } catch (err) {
    console.error('❌ Error crearPedido:', err)
    return { ok: false, error: err.message }
  }
}

// ======================================================
// 📌 TRAER PEDIDOS PAGADOS
// ======================================================
export async function traerPedidos(usuarioId) {
  const ref = collection(db, 'compras')
  const q = query(ref, where('usuarioId', '==', usuarioId))
  const snap = await getDocs(q)

  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ======================================================
// 📌 TRAER PENDIENTES
// ======================================================
export async function traerPedidosPendientes(usuarioId) {
  const ref = collection(db, 'comprasPendientes')
  const q = query(ref, where('usuarioId', '==', usuarioId))
  const snap = await getDocs(q)

  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ======================================================
// 📌 OBTENER POR ESTADO (React version)
// ======================================================
export async function obtenerPedidosPorEstado(usuarioId, estado = 'pagado') {
  if (!usuarioId) return []
  return estado === 'pagado'
    ? traerPedidos(usuarioId)
    : traerPedidosPendientes(usuarioId)
}

// ======================================================
// 📌 ELIMINAR PENDIENTE
// ======================================================
export async function eliminarPedidoPendiente(id) {
  try {
    await deleteDoc(doc(db, 'comprasPendientes', id))
    return true
  } catch (err) {
    console.error('❌ eliminarPedidoPendiente', err)
    return false
  }
}

// ======================================================
// 📌 MARCAR COMO PAGADO (cuando MP vuelve OK)
// ======================================================
export async function marcarPedidoPagado(id) {
  try {
    const ref = doc(db, 'comprasPendientes', id)
    const snap = await getDoc(ref)

    if (!snap.exists()) return false

    const data = snap.data()

    // mover a "compras"
    await addDoc(collection(db, 'compras'), {
      ...data,
      pagado: true,
      estado: 'pagado',
      fechaPago: serverTimestamp(),
    })

    await deleteDoc(ref)

    return true
  } catch (err) {
    console.error('❌ marcarPedidoPagado', err)
    return false
  }
}

// ======================================================
// 📌 HISTORIAL TOTAL
// ======================================================
export async function obtenerHistorialDeCompras(usuarioId) {
  const p = await traerPedidos(usuarioId)
  const pp = await traerPedidosPendientes(usuarioId)
  return [...p, ...pp]
}
