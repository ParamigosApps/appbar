// --------------------------------------------------------------
// Servicio Mercado Pago — ENTRADAS (Frontend)
// --------------------------------------------------------------

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

    const body = {
      title: titulo,
      quantity: cantidad,
      unit_price: Number(precio),
      price: Number(precio),
      imagenEventoUrl,
      description: titulo,
      external_reference: `${usuarioId}_${eventoId}`,
    }

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    let data
    try {
      data = await res.json()
    } catch (err) {
      console.error('❌ ERROR: respuesta no es JSON:', err)
      return null
    }

    console.log('🔵 RESPUESTA MP (Frontend):', data)

    // 👉 SIEMPRE USAR init_point
    if (data?.init_point) return data.init_point

    console.error('⚠️ Mercado Pago no devolvió init_point:', data)
    return null
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}
