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
  if (!user || !user.uid) throw new Error('Usuario no autenticado')

  let email = user.email || ''
  let nombre = user.displayName || ''

  if (!email || !nombre) {
    const ref = doc(db, 'usuarios', user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data()
      if (!email) email = data.email || ''
      if (!nombre) nombre = data.nombre || data.displayName || ''
    }
  }

  return { uid: user.uid, email, nombre }
}

// --------------------------------------------------
// ENTRADAS (EVENTOS)
// --------------------------------------------------
export async function crearPreferenciaEntrada({
  eventoId,
  pagoId,
  items,
  imagenEventoUrl,
}) {
  try {
    const perfil = await obtenerPerfilUsuario()

    let total = 0

    const itemsMP = items.map((i, idx) => {
      const cantidad = Math.max(1, Math.trunc(Number(i.cantidad)))
      const precio = normalizarPrecio(i.precio)

      total += cantidad * precio

      return {
        id: i.id || `entrada_${idx + 1}_${i.nombre}`,
        title: String(i.nombre),
        description: `Entrada ${i.nombre} - Evento ${eventoId}`,
        quantity: cantidad,
        unit_price: precio,
        currency_id: 'ARS',
        category_id: 'tickets',
      }
    })

    console.log('🧾 Preferencia ENTRADA payload', {
      pagoId,
      total,
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
        imagenEventoUrl,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('❌ Backend MP error:', data)
      return null
    }

    // ⬅️ DEVOLVEMOS TAMBIÉN EL TOTAL
    return {
      ...data,
      total,
    }
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

    let total = 0

    const itemsMP = carrito.map((p, idx) => {
      const precio = normalizarPrecio(p.precio)
      const cantidad = Math.trunc(Number(p.enCarrito))

      if (
        !Number.isFinite(precio) ||
        precio <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
      ) {
        throw new Error('Item inválido para Mercado Pago')
      }

      total += cantidad * precio

      return {
        id: p.id || `producto_${idx + 1}_${p.nombre}`,
        title: String(p.nombre),
        description: `Compra de ${p.nombre}`,
        quantity: cantidad,
        unit_price: precio,
        currency_id: 'ARS',
        category_id: 'retail',
      }
    })

    console.log('🧾 Preferencia COMPRA payload', {
      pagoId,
      total,
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

    if (!res.ok || !data?.init_point) {
      console.error('❌ Backend MP error:', data)
      return null
    }

    // ⬅️ DEVOLVEMOS init_point + total
    return {
      init_point: data.init_point,
      total,
    }
  } catch (err) {
    console.error('❌ Error crearPreferenciaCompra:', err)
    return null
  }
}
