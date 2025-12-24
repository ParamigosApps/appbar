// --------------------------------------------------------------
// Servicio Mercado Pago — ENTRADAS (Frontend)
// Responsabilidad ÚNICA: hablar con /api/crear-preferencia
// --------------------------------------------------------------

export async function crearPreferenciaEntrada({
  usuarioId,
  eventoId,
  pagoId,
  items,
  imagenEventoUrl,
}) {
  try {
    // ----------------------------------------------------------
    // LOG REQUEST (DEBUG)
    // ----------------------------------------------------------
    console.group('📡 crearPreferenciaEntrada() FRONTEND')
    console.log('usuarioId:', usuarioId)
    console.log('eventoId:', eventoId)
    console.log('items enviados:', items)
    console.groupEnd()

    const body = {
      items,
      imagenEventoUrl,
      external_reference: pagoId, // 🔑 CLAVE PARA EL WEBHOOK
    }

    const res = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // ----------------------------------------------------------
    // HTTP ERROR
    // ----------------------------------------------------------
    if (!res.ok) {
      const raw = await res.text()
      console.error('❌ Backend MP error HTTP:', res.status, raw)
      return null
    }

    const data = await res.json()

    // ----------------------------------------------------------
    // LOG RESPONSE
    // ----------------------------------------------------------
    console.log('📡 Backend MP JSON:', data)

    return data // ⚠️ NO devolver solo init_point
  } catch (err) {
    console.error('❌ Error crearPreferenciaEntrada:', err)
    return null
  }
}
