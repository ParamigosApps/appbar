// src/services/mercadoPagoEntradas.js

import { auth, db } from '../Firebase.js'
import { doc, getDoc } from 'firebase/firestore'

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
function normalizarPrecio(valor) {
  if (!valor) return 0
  if (typeof valor === 'string') {
    return Number(
      valor.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim()
    )
  }
  return Number(valor) || 0
}

async function obtenerPerfilUsuario() {
  const user = auth.currentUser

  if (!user || !user.uid) {
    throw new Error('Usuario no autenticado')
  }

  let email = user.email || ''
  let nombre = user.displayName || ''

  // 🔹 Fallback a Firestore
  if (!email || !nombre) {
    const ref = doc(db, 'usuarios', user.uid)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const data = snap.data()
      if (!email) email = data.email || ''
      if (!nombre) nombre = data.nombre || data.displayName || ''
    }
  }

  console.table({
    uid: user.uid,
    email,
    nombre,
  })

  return {
    uid: user.uid,
    email,
    nombre,
  }
}

// --------------------------------------------------
// ENTRADAS (EVENTOS)
// -------------------------------------------------
export async function crearPreferenciaEntrada({
  eventoId,
  pagoId,
  items,
  imagenEventoUrl,
}) {
  try {
    const perfil = await obtenerPerfilUsuario()

    const itemsMP = items.map((i, idx) => ({
      id: i.id || `entrada_${idx + 1}_${i.nombre}`,
      title: String(i.nombre),
      description: `Entrada ${i.nombre} - Evento ${eventoId}`,
      quantity: Math.max(1, Math.trunc(Number(i.cantidad))),
      unit_price: normalizarPrecio(i.precio),
      currency_id: 'ARS',
      category_id: 'tickets',
    }))

    console.log('🧾 Preferencia ENTRADA payload', {
      pagoId,
      usuarioEmail: perfil.email,
      usuarioNombre: perfil.nombre,
      itemsMP,
    })

    const body = {
      external_reference: pagoId,
      usuarioEmail: perfil.email,
      usuarioNombre: perfil.nombre,
      items: itemsMP,
      imagenEventoUrl,
    }

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('❌ Backend MP error:', data)
      return null
    }

    return data
  } catch (err) {
    console.error('❌ crearPreferenciaEntrada ERROR:', err)
    return null
  }
}

// --------------------------------------------------
// COMPRAS (CARRITO)
// --------------------------------------------------
export async function crearPreferenciaCompra({ carrito, pagoId }) {
  try {
    const perfil = await obtenerPerfilUsuario()

    const itemsMP = carrito.map((p, idx) => {
      const precioNum = normalizarPrecio(p.precio)
      const cantidadNum = Math.trunc(Number(p.enCarrito))

      if (
        !Number.isFinite(precioNum) ||
        precioNum <= 0 ||
        !Number.isInteger(cantidadNum) ||
        cantidadNum <= 0
      ) {
        throw new Error('Item inválido para Mercado Pago')
      }

      return {
        id: p.id || `producto_${idx + 1}_${p.nombre}`,
        title: String(p.nombre),
        description: `Compra de ${p.nombre}`,
        quantity: cantidadNum,
        unit_price: precioNum,
        currency_id: 'ARS',
        category_id: 'retail',
      }
    })

    console.log('🧾 Preferencia COMPRA payload', {
      pagoId,
      usuarioEmail: perfil.email,
      usuarioNombre: perfil.nombre,
      itemsMP,
    })

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_reference: pagoId,
        usuarioEmail: perfil.email,
        usuarioNombre: perfil.nombre,
        items: itemsMP,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('❌ Backend MP error:', data)
      return null
    }

    if (!data?.init_point) {
      console.error('❌ MP sin init_point:', data)
      return null
    }

    return data.init_point
  } catch (err) {
    console.error('❌ Error crearPreferenciaCompra:', err)
    return null
  }
}
