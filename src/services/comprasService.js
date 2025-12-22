// --------------------------------------------------------------
// src/services/comprasService.js — VERSIÓN MASTER DEFINITIVA
// --------------------------------------------------------------

import Swal from 'sweetalert2'

import { db, auth } from '../Firebase.js'
import {
  addDoc,
  getDoc,
  updateDoc,
  getDocs,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
  query,
  where,
  setDoc,
} from 'firebase/firestore'

import {
  generarCompraQr,
  subirQrGeneradoAFirebase,
} from './generarQrService.js'

// --------------------------------------------------------------
// 📌 FECHA EXACTA (idéntica al proyecto original)
// --------------------------------------------------------------
export function obtenerFechaCompra() {
  const fecha = new Date().toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  })
  const [soloFecha, soloHora] = fecha.split(',')
  return `${soloFecha} - ${soloHora.trim()} HS`
}

// --------------------------------------------------------------
// 📌 AUTOINCREMENTAL — Pedido #1001 → #1002 → #1003...
// --------------------------------------------------------------
async function obtenerNumeroPedido() {
  const ref = doc(db, 'configuracion', 'pedidos')
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(ref, { numeroActual: 1000 })
    return 1000
  }

  const numeroActual = snap.data()?.numeroActual ?? 1000
  const siguiente = numeroActual + 1

  await updateDoc(ref, { numeroActual: siguiente })
  return siguiente
}

// --------------------------------------------------------------
// 📌 CONTAR PENDIENTES (máximo 3)
// --------------------------------------------------------------
async function contarPendientes(usuarioId) {
  const q = query(
    collection(db, 'compras'),
    where('usuarioId', '==', usuarioId),
    where('estado', '==', 'pendiente')
  )

  const snap = await getDocs(q)
  return snap.size
}

export async function validarLimitePendientes(usuarioId) {
  return (await contarPendientes(usuarioId)) >= 3
}

// --------------------------------------------------------------
// 📌 RESERVAR STOCK SI EL PEDIDO ES PENDIENTE
// --------------------------------------------------------------
async function reservarStock(items) {
  for (const item of items) {
    const ref = doc(db, 'productos', item.id)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const data = snap.data()
    const nuevoStock = (data.stock || 0) - item.enCarrito

    if (nuevoStock >= 0) {
      await updateDoc(ref, { stock: nuevoStock })
    }
  }
}

// --------------------------------------------------------------
// 📌 DEVOLVER STOCK — usado por expiración
// --------------------------------------------------------------
export async function devolverStock(items) {
  for (const item of items) {
    const ref = doc(db, 'productos', item.id)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const data = snap.data()
    await updateDoc(ref, { stock: (data.stock || 0) + item.enCarrito })
  }
}

// --------------------------------------------------------------
// 🧾 CREAR PEDIDO (QR SIEMPRE)
// --------------------------------------------------------------
export async function crearPedido({ carrito, total, lugar, pagado, evento }) {
  if (!auth.currentUser) {
    throw new Error('Usuario no autenticado')
  }

  const usuarioId = auth.currentUser.uid

  // 🔥 Límite de 3 pendientes
  if (!pagado) {
    if (await validarLimitePendientes(usuarioId)) {
      throw new Error('Límite de pedidos alcanzado (máximo 3 pendientes)')
    }
  }

  const ticketId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`
  const numeroPedido = await obtenerNumeroPedido()
  const fechaHumana = obtenerFechaCompra()

  // 🔑 Texto lógico del QR

  const qrText = JSON.stringify({
    tipo: 'compra',
    ticketId,
  })

  // 🔥 Reservar stock si es pendiente
  if (!pagado) {
    await reservarStock(carrito)
  }

  const expiraEn = pagado
    ? null
    : Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000))
  // --------------------------------------------------
  // 1️⃣ CREAR PEDIDO EN FIRESTORE
  // --------------------------------------------------
  const ref = await addDoc(collection(db, 'compras'), {
    // -----------------------------
    // 👤 USUARIO
    // -----------------------------
    usuarioId,
    usuarioNombre: auth.currentUser?.displayName || 'Usuario',

    // -----------------------------
    // 🧾 COMPRA
    // -----------------------------
    items: carrito,
    total,
    lugar,

    numeroPedido,
    ticketId,

    // -----------------------------
    // 🔒 SNAPSHOT INMUTABLE DEL EVENTO
    // -----------------------------
    eventoId: evento?.id || null,
    nombreEvento: evento?.nombre || null,
    fechaEvento: evento?.fechaInicio || null,
    horaEvento: evento?.horaInicio || null,

    // -----------------------------
    // 💰 ESTADO
    // -----------------------------
    pagado: Boolean(pagado),
    estado: pagado ? 'pagado' : 'pendiente',

    origenPago: pagado ? 'online' : 'caja',
    // -----------------------------
    // 🎫 TICKET / CAJA
    // -----------------------------
    ticketImpreso: false,
    ticketImpresoEn: null,

    retirada: false,
    retiradaEn: null,
    retiradaPor: null,

    // -----------------------------
    // 🔗 QR
    // -----------------------------
    qrText,
    qrUrl: null,

    // -----------------------------
    // ⏱️ METADATA
    // -----------------------------
    creadoEn: serverTimestamp(),
    expiraEn: expiraEn || null,
  })

  // --------------------------------------------------
  // 2️⃣ GENERAR QR VISUAL (SIEMPRE)
  // --------------------------------------------------
  try {
    const qrDiv = await generarCompraQr({
      compraId: ref.id,
      numeroPedido,
      usuarioId,
    })

    const qrUrl = await subirQrGeneradoAFirebase({
      qrDiv,
      path: `qr/compras/${ref.id}.png`,
    })

    // --------------------------------------------------
    // 3️⃣ GUARDAR QR EN FIRESTORE
    // --------------------------------------------------
    await updateDoc(doc(db, 'compras', ref.id), {
      qrUrl,
    })

    return {
      id: ref.id,
      ticketId,
      numeroPedido,
      fechaHumana,
      total,
      lugar,
      qrText,
      qrUrl,
    }
  } catch (err) {
    console.error('❌ Error generando QR del pedido:', err)

    return {
      id: ref.id,
      ticketId,
      numeroPedido,
      fechaHumana,
      total,
      lugar,
      qrText,
      qrUrl: null,
    }
  }
}
