// --------------------------------------------------------------
// src/services/comprasService.js — MASTER DEFINITIVA (CORREGIDA)

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
import { showLoading, hideLoading } from './loadingService.js'

export function obtenerFechaCompra() {
  const fecha = new Date().toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  })
  const [soloFecha, soloHora] = fecha.split(',')
  return `${soloFecha} - ${soloHora.trim()} HS`
}

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
// 📌 RESERVAR STOCK (pedido pendiente)
// --------------------------------------------------------------
async function reservarStock(items) {
  for (const item of items) {
    const ref = doc(db, 'productos', item.id)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const data = snap.data()
    const stock = Number(data.stock || 0)
    const qty = Number(item.enCarrito || 0)
    const nuevoStock = stock - qty

    if (nuevoStock >= 0) {
      await updateDoc(ref, { stock: nuevoStock })
    }
  }
}

// --------------------------------------------------------------
// 📌 DEVOLVER STOCK (expiración o cancelación)
// --------------------------------------------------------------
export async function devolverStock(items) {
  for (const item of items) {
    const ref = doc(db, 'productos', item.id)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const data = snap.data()
    const stock = Number(data.stock || 0)
    const qty = Number(item.enCarrito || 0)

    await updateDoc(ref, { stock: stock + qty })
  }
}

// --------------------------------------------------------------
// 📌 OBTENER PERFIL DE USUARIO ROBUSTO
// - displayName/email desde auth
// - fallback a usuarios/{uid}
// --------------------------------------------------------------
async function obtenerPerfilUsuario(uid) {
  const authUser = auth.currentUser

  let usuarioNombre =
    authUser?.displayName || authUser?.providerData?.[0]?.displayName || ''

  let usuarioEmail = authUser?.email || authUser?.providerData?.[0]?.email || ''

  try {
    const userSnap = await getDoc(doc(db, 'usuarios', uid))
    if (userSnap.exists()) {
      const data = userSnap.data() || {}
      if (!usuarioNombre && data.nombre) usuarioNombre = data.nombre
      if (!usuarioNombre && data.displayName) usuarioNombre = data.displayName
      if (!usuarioEmail && data.email) usuarioEmail = data.email
    }
  } catch (e) {
    console.warn('⚠️ No se pudo leer usuarios/{uid}:', e?.message || e)
  }

  return {
    usuarioNombre: usuarioNombre || 'Usuario',
    usuarioEmail: usuarioEmail || '',
  }
}

// --------------------------------------------------------------
// 🧾 CREAR PEDIDO (QR SIEMPRE)
// --------------------------------------------------------------
export async function crearPedido({
  carrito,
  total,
  lugar,
  evento,
  origenPago, // 'mp' | 'caja'
}) {
  if (!auth.currentUser) throw new Error('Usuario no autenticado')

  const usuarioId = auth.currentUser.uid

  // límite pendientes
  if (await validarLimitePendientes(usuarioId)) {
    throw new Error('Límite de pedidos alcanzado (máximo 3 pendientes)')
  }

  // Validación básica
  if (!Array.isArray(carrito) || carrito.length === 0) {
    throw new Error('Carrito vacío')
  }

  showLoading({
    title: 'Generando ticket',
    text: 'Aguarda unos instantes..',
  })

  // IDs
  const ticketId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`
  const numeroPedido = await obtenerNumeroPedido()
  const fechaHumana = obtenerFechaCompra()

  // Texto QR lógico
  const qrText = JSON.stringify({ tipo: 'compra', ticketId })

  // Reservar stock (siempre que quede pendiente)
  await reservarStock(carrito)

  // Expira en 15 min para mp/caja (liberación por cron/manual)
  const expiraEn =
    origenPago === 'mp' || origenPago === 'caja'
      ? Timestamp.fromDate(new Date(Date.now() + 1 * 60 * 1000))
      : null

  // Perfil usuario (nombre/email)
  const { usuarioNombre, usuarioEmail } = await obtenerPerfilUsuario(usuarioId)

  // Snapshot evento (alineado a tu app)
  const eventoId = evento?.id || null
  const nombreEvento = evento?.nombre || null
  const fechaEvento = evento?.fechaInicio || null
  const horaInicio = evento?.horaInicio || null
  const horaFin = evento?.horaFin || null
  const lugarEvento = evento?.lugar || null

  // --------------------------------------------------
  // 1) CREAR COMPRA EN FIRESTORE
  // --------------------------------------------------
  const ref = await addDoc(collection(db, 'compras'), {
    // Usuario
    usuarioId,
    usuarioNombre,
    usuarioEmail,

    // Compra
    items: carrito,
    total,
    lugar,
    metodo: origenPago, // compat con tus docs (metodo: "mp" / "caja")
    origenPago, // por si lo usás en admin
    descripcion:
      carrito.length === 1
        ? `${carrito[0]?.enCarrito || 1} ${
            carrito[0]?.nombre || 'Item'
          } ($${total})`
        : `${carrito.length} items ($${total})`,

    // IDs
    numeroPedido,
    ticketId,

    // VÍNCULO CON PAGO (CLAVE)
    pagoId: '',

    // Evento
    eventoId,
    nombreEvento,
    fechaEvento,
    horaInicio,
    horaFin,
    lugarEvento,

    // Estado
    pagado: false,
    estado: 'pendiente',
    paymentStartedAt: serverTimestamp(),

    // Ticket / retiro
    ticketImpreso: false,
    ticketImpresoEn: null,
    retirada: false,
    retiradaEn: null,
    retiradaPor: null,

    // QR
    qrText,
    qrUrl: null,

    // Metadata
    creadoEn: serverTimestamp(),
    expiraEn: expiraEn || null,

    // Campos auxiliares si los tenés en tu modelo
    entradasGratisPendientes: [],
    itemsSolicitados: [],
    gratisEntregadas: false,
  })
  // --------------------------------------------------
  // 1️⃣ CREAR DOC EN PAGOS (TIPO COMPRA) MODIFICADO
  // --------------------------------------------------
  const pagoRef = await addDoc(collection(db, 'pagos'), {
    tipo: 'compra',
    metodo: origenPago === 'mp' ? 'mp' : 'caja',
    estado: 'pendiente',

    compraId: ref.id,
    usuarioId,
    usuarioNombre,
    usuarioEmail,

    total: Number(total) || 0,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const pagoId = pagoRef.id
  // --------------------------------------------------
  // 2️⃣ VINCULAR COMPRA ↔ PAGO (CLAVE) MODIFICADO
  // --------------------------------------------------
  await updateDoc(ref, {
    pagoId,
    updatedAt: serverTimestamp(),
  })
  try {
    // --------------------------------------------------
    // 2) GENERAR QR VISUAL
    // --------------------------------------------------
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
    // 3) GUARDAR QR
    // --------------------------------------------------
    await updateDoc(doc(db, 'compras', ref.id), { qrUrl })

    return {
      id: ref.id,
      ticketId,
      pagoId,
      numeroPedido,
      fechaHumana,
      total,
      lugar,
      qrText,
      qrUrl,
      usuarioEmail,
      usuarioNombre,
    }
  } catch (err) {
    console.error('❌ Error generando QR del pedido:', err)

    // Devuelve igualmente, pero sin qrUrl
    return {
      id: ref.id,
      ticketId,
      pagoId,
      numeroPedido,
      fechaHumana,
      total,
      lugar,
      qrText,
      qrUrl: null,
      usuarioEmail,
      usuarioNombre,
    }
  } finally {
    hideLoading()
  }
}
