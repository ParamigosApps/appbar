// src/services/mercadoPagoEntradas.js

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
  usuarioId,
  eventoId,
  pagoId,
  items,
  imagenEventoUrl,
}) {
  const body = {
    items,
    imagenEventoUrl,
    external_reference: pagoId,
  }

  const res = await fetch('/api/crear-preferencia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const raw = await res.text()
    console.error('❌ Backend MP error:', raw)
    return null
  }

  return await res.json()
}
export async function crearPreferenciaCompra({ carrito, ticketId }) {
  try {
    // ============================
    // VALIDAR Y ARMAR ITEMS
    // ============================
    const items = carrito.map(p => {
      const precioNum = normalizarPrecio(p.precio)
      const cantidadNum = Number(p.enCarrito)

      if (
        !Number.isFinite(precioNum) ||
        precioNum <= 0 ||
        !Number.isInteger(cantidadNum) ||
        cantidadNum <= 0
      ) {
        throw new Error('Item inválido para Mercado Pago')
      }

      return {
        title: String(p.nombre),
        quantity: cantidadNum,
        unit_price: precioNum,
        currency_id: 'ARS',
      }
    })

    // ============================
    // FETCH
    // ============================
    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        external_reference: ticketId,
      }),
    })

    // ============================
    // LEER JSON UNA SOLA VEZ
    // ============================
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
