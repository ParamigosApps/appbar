import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  console.log('🔵 /api/crear-preferencia INICIADA')

  // ======================================================
  // LEER RAW BODY (Vercel edge)
  // ======================================================
  let rawBody = ''
  await new Promise(resolve => {
    req.on('data', chunk => (rawBody += chunk))
    req.on('end', resolve)
  })

  console.log('🟠 RAW BODY RECIBIDO:', rawBody)

  let body
  try {
    body = JSON.parse(rawBody)
    console.log('📌 BODY PARSEADO:', body)
  } catch (err) {
    console.error('❌ ERROR PARSEANDO JSON:', err)
    return res.status(400).json({ error: 'JSON inválido', raw: rawBody })
  }

  // ======================================================
  // VALIDAR TOKEN MP (PRODUCCIÓN)
  // ======================================================
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

  console.log('🔑 TOKEN PRESENTE?', !!ACCESS_TOKEN)

  if (!ACCESS_TOKEN) {
    return res.status(500).json({
      error: 'Falta MP_ACCESS_TOKEN en Vercel',
    })
  }

  const client = new MercadoPagoConfig({
    accessToken: ACCESS_TOKEN,
  })

  const preference = new Preference(client)

  // ======================================================
  // ITEMS — NORMALIZACIÓN
  // ======================================================
  let items = body.items

  if (!Array.isArray(items)) {
    console.log('⚠ items NO vino → generando item único')

    items = [
      {
        title: body.title || 'Entrada',
        quantity: Number(body.quantity ?? 1),
        unit_price: Number(body.unit_price ?? body.price ?? 0),
        currency_id: 'ARS',
        description: body.description || '',
        picture_url: body.picture_url ?? body.imagenEventoUrl ?? '',
      },
    ]
  }

  console.log('📦 ITEMS:', items)

  // ======================================================
  // BASE URL DEL PROYECTO (PRODUCCIÓN)
  // ======================================================
  const BASE_URL = 'https://appbar-react-final.vercel.app'

  // ======================================================
  // CONSTRUCCIÓN DE LA PREFERENCIA
  // ======================================================
  try {
    console.log('🚀 Creando preferencia en Mercado Pago…')

    const result = await preference.create({
      body: {
        items,
        external_reference: body.external_reference || 'sin_ref',
        auto_return: 'approved',

        back_urls: {
          success: `${BASE_URL}/pago-exitoso.html`,
          failure: `${BASE_URL}/pago-fallido.html`,
          pending: `${BASE_URL}/pago-pendiente.html`,
        },

        // IMPORTANTE: esto NO fuerza sandbox.
        // Si usás PROD ACCESS_TOKEN → usa entorno real, pero
        // las tarjetas APRO simulan pagos sin cobrar.
        metadata: { origen: 'appbar', tipo: 'entrada' },
      },
    })

    console.log('✅ PREFERENCIA CREADA:', result)

    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point, // útil si usaras token sandbox
    })
  } catch (error) {
    console.error('❌ ERROR PREFERENCIA:', error)

    return res.status(500).json({
      error: error.message,
      data: error,
    })
  }
}
