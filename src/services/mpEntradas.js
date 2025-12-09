// --------------------------------------------------------------
// Servicio Mercado Pago — ENTRADAS (Funciona con tu API en Vercel)
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

    // Body que tu backend espera
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

    // Preferimos sandbox SIEMPRE
    if (data?.sandbox_init_point) return data.sandbox_init_point
    if (data?.init_point) return data.init_point

    console.error('⚠️ Mercado Pago no devolvió init_point:', data)
    return null
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}
