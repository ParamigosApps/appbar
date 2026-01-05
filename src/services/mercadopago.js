// src/services/mercadopago.js

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

export async function crearPreferenciaEntrada({
  eventoId,
  pagoId,
  items,
  imagenEventoUrl,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
}) {
  try {
    if (!usuarioId) {
      throw new Error('Usuario no autenticado')
    }

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
      usuarioEmail,
      usuarioNombre,
      itemsMP,
    })

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_reference: pagoId,
        usuarioId,
        usuarioEmail,
        usuarioNombre,
        items: itemsMP,
        imagenEventoUrl,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data?.init_point) {
      console.error('❌ Backend MP error:', data)
      return null
    }

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
export async function crearPreferenciaCompra({
  carrito,
  pagoId,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
}) {
  try {
    if (!usuarioId) throw new Error('Usuario no autenticado')

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

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_reference: pagoId,
        usuarioId,
        usuarioEmail,
        usuarioNombre,
        items: itemsMP,
      }),
    })

    const data = await res.json().catch(() => null)

    // Devuelve SIEMPRE string o null (así evitás /[object Object] para siempre)
    const initPoint =
      typeof data?.init_point === 'string'
        ? data.init_point
        : typeof data?.initPoint === 'string'
        ? data.initPoint
        : null

    if (!res.ok || !initPoint) {
      console.error('❌ Backend MP error:', { status: res.status, data })
      return null
    }

    return initPoint
  } catch (err) {
    console.error('❌ Error crearPreferenciaCompra:', err)
    return null
  }
}
