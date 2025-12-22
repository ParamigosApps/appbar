// ========================================
// MERCADO PAGO – React Version
// Igual a tu proyecto original
// ========================================

// ========================================
// MERCADO PAGO – React Version (Entradas)
// ========================================

export async function crearPreferenciaEntrada({
  usuarioId,
  eventoId,
  nombreEvento,
  cantidad,
  precio,
  detalleEntradas,
  imagenEventoUrl,
}) {
  try {
    const cantidadNum = Number(cantidad)
    const precioNum = Number(precio)

    // 🔒 VALIDACIONES DURAS
    if (
      !Number.isInteger(cantidadNum) ||
      cantidadNum <= 0 ||
      !Number.isFinite(precioNum) ||
      precioNum <= 0
    ) {
      throw new Error('Datos inválidos para Mercado Pago')
    }

    // 🧾 TÍTULO CLARO
    const titulo = `Entradas — ${nombreEvento}`

    // 🧾 DESCRIPCIÓN REAL
    const descripcion = detalleEntradas
      ? `${detalleEntradas}\n\nEvento: ${nombreEvento}`
      : `Entrada para ${nombreEvento}`

    const body = {
      items: [
        {
          title: titulo,
          quantity: 1, // ✅ SIEMPRE 1
          unit_price: precioNum, // ✅ NUMBER VALIDADO
          currency_id: 'ARS',
          picture_url: imagenEventoUrl || '',
          description: descripcion,
        },
      ],
      external_reference: `${usuarioId}_${eventoId}`,
    }

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('❌ Error backend MP:', err)
      return null
    }

    const data = await res.json()

    if (!data?.init_point) {
      console.error('❌ MP sin init_point:', data)
      return null
    }

    return data.init_point
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}

// --------------------------------------------------------------
// src/services/mercadopago.js — VERSIÓN FUNCIONAL
// --------------------------------------------------------------

// --------------------------------------------------------------
// src/services/mercadopago.js — VERSIÓN FINAL SEGURA
// --------------------------------------------------------------

function normalizarPrecio(valor) {
  if (!valor) return 0
  if (typeof valor === 'string') {
    return Number(
      valor.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim()
    )
  }
  return Number(valor) || 0
}

export async function crearPreferenciaCompra({ carrito, ticketId }) {
  try {
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
        title: p.nombre,
        quantity: cantidadNum,
        unit_price: precioNum,
        currency_id: 'ARS',
      }
    })

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        external_reference: ticketId,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('❌ Error backend MP:', err)
      return null
    }

    const data = await res.json()

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
