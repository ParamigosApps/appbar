export async function crearPreferenciaEntrada({
  usuarioId,
  eventoId,
  items,
  imagenEventoUrl,
}) {
  try {
    if (!Array.isArray(items) || !items.length) {
      throw new Error('Items inválidos para Mercado Pago')
    }

    const body = {
      items: items.map(i => {
        if (
          !Number.isFinite(i.unit_price) ||
          i.unit_price <= 0 ||
          !Number.isInteger(i.quantity) ||
          i.quantity <= 0
        ) {
          throw new Error('Item inválido enviado a MP')
        }

        return {
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unit_price,
          currency_id: 'ARS',
          picture_url: imagenEventoUrl || '',
        }
      }),
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
    return data?.init_point || null
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}

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
