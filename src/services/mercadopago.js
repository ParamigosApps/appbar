// ========================================
// MERCADO PAGO – React Version
// Igual a tu proyecto original
// ========================================

export async function crearPreferenciaEntrada({
  usuarioId,
  eventoId,
  nombreEvento,
  cantidad,
  precio,
  imagenEventoUrl,
}) {
  try {
    const titulo = `${cantidad} Entrada${
      cantidad > 1 ? 's' : ''
    } — ${nombreEvento}`

    const descripcion = `Evento: ${nombreEvento}
Cantidad: ${cantidad}
Precio unitario: $${precio}
Total: $${precio * cantidad}
Usuario: ${usuarioId}`

    const body = {
      title: titulo,
      items: [
        {
          title: titulo,
          quantity: cantidad,
          unit_price: Number(precio),
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

    const data = await res.json()
    return data.init_point
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}

// --------------------------------------------------------------
// src/services/mercadopago.js — VERSIÓN FUNCIONAL
// --------------------------------------------------------------

export async function crearPreferenciaCompra({ carrito, ticketId }) {
  try {
    const resp = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `APP_USR-5795035815589721-100821-1783c54528b8fb8b0fed90918f041145-2914738230`, // ⚠️ reemplazar
        },
        body: JSON.stringify({
          items: carrito.map(p => ({
            title: p.nombre,
            quantity: p.enCarrito,
            currency_id: 'ARS',
            unit_price: Number(
              p.precio
                .toString()
                .replace('$', '')
                .replace('.', '')
                .replace(',', '')
            ),
          })),
          external_reference: ticketId,
          back_urls: {
            success: 'https://todovaper.com.ar/success',
            failure: 'https://todovaper.com.ar/error',
          },
          auto_return: 'approved',
        }),
      }
    )

    const data = await resp.json()

    if (!data.init_point) {
      console.error('MP response:', data)
      return null
    }

    return data.init_point
  } catch (err) {
    console.error('❌ Error crearPreferenciaCompra:', err)
    return null
  }
}
