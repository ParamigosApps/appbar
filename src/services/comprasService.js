// --------------------------------------------------------------
// src/services/comprasService.js — VERSIÓN MASTER DEFINITIVA
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

import { db, auth } from '../Firebase.js'
import {
  addDoc,
  getDoc,
  updateDoc,
  getDocs,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  setDoc,
} from 'firebase/firestore'

import { generarCompraQr } from '../services/generarQrService.js'

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
// 📌 CREAR PEDIDO (flujo central)
// --------------------------------------------------------------
export async function crearPedido({ carrito, total, lugar, pagado }) {
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

  const qrText = `Compra:${ticketId}`
  // 🔥 Reservar stock si es pendiente
  if (!pagado) {
    await reservarStock(carrito)
  }

  // 🔥 Expira en 15 min (solo relevante si pendiente)
  const expiraEn = pagado
    ? null
    : new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const ref = await addDoc(collection(db, 'compras'), {
    usuarioId,
    usuarioNombre: auth.currentUser.displayName || 'Usuario',
    items: carrito,
    total,
    lugar,
    pagado,
    estado: pagado ? 'pagado' : 'pendiente',
    ticketId,
    numeroPedido,

    qrText, // 👈 SE GUARDA
    usado: false,
    expiraEn,
    creadoEn: serverTimestamp(),
  })

  // 🔁 Retorno a React
  return {
    id: ref.id,
    ticketId,
    numeroPedido,
    fechaHumana,
    total,
    lugar,
    qrText,
  }
}

// --------------------------------------------------------------
// 📌 MOSTRAR TICKET + QR + PDF + WhatsApp
// --------------------------------------------------------------
export async function mostrarQrCompra({
  carrito,
  total,
  ticketId,
  numeroPedido,
  lugar,
  estado,
}) {
  const fechaHumana = obtenerFechaCompra()
  const usuarioNombre = auth.currentUser.displayName || 'Usuario'

  await Swal.fire({
    title: '🧾 Ticket de compra',
    width: '420px',
    html: `
      <div id="ticketGenerado" style="font-size:15px;text-align:left;">
        <p><strong style="font-size:18px">Pedido #${numeroPedido}</strong></p>
        <p><strong>Estado:</strong> ${estado.toUpperCase()}</p>
        <p><strong>Cliente:</strong> ${usuarioNombre}</p>
        <p><strong>Fecha:</strong> ${fechaHumana}</p>
        <p><strong>Lugar:</strong> ${lugar}</p>

        <hr>

        ${carrito
          .map(
            p =>
              `<p>- ${p.nombre} ×${p.enCarrito} → $${
                p.precio * p.enCarrito
              }</p>`
          )
          .join('')}

        <hr>
        <p style="font-size:20px;"><strong>Total: $${total}</strong></p>

        <div id="qrCompraContainer"
             style="display:flex; justify-content:center; margin-top:12px;">
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:15px;">
        <button id="btnPdf" class="btn btn-dark" style="flex:1;">PDF</button>
        <button id="btnWsp" class="btn btn-success" style="flex:1;">WhatsApp</button>
      </div>
    `,
    didOpen: async () => {
      const qrContainer = document.getElementById('qrCompraContainer')

      await generarCompraQr({
        ticketId,
        contenido: `Compra:${ticketId}`,
        qrContainer,
        tamaño: 200,
      })

      document.getElementById('btnPdf')?.addEventListener('click', async () => {
        const ticket = document.getElementById('ticketGenerado')
        const canvas = await html2canvas(ticket)
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF()
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0)
        pdf.save(`ticket-${numeroPedido}.pdf`)
      })

      document.getElementById('btnWsp')?.addEventListener('click', () => {
        let msg = `🧾 *Ticket de compra*%0A`
        msg += `Pedido #${numeroPedido}%0A`
        msg += `Total: $${total}%0A`
        msg += `Fecha: ${fechaHumana}%0A`
        msg += `Estado: ${estado.toUpperCase()}%0A`
        window.open(`https://wa.me/?text=${msg}`, '_blank')
      })
    },
    confirmButtonText: 'Cerrar',
    customClass: { confirmButton: 'btn btn-dark' },
    buttonsStyling: false,
  })
}
