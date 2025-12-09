import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  console.log('🔵 /api/crear-preferencia INICIADA')

  // ======================================================
  // LEER RAW BODY
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
    return res.status(400).json({ error: 'JSON inválido' })
  }

  // ======================================================
  // VALIDAR TOKEN
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
  // ITEMS
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

  console.log('📦 ITEMS DEFINITIVOS:', items)

  const BASE_URL = 'https://appbar-react-final.vercel.app'

  // ======================================================
  // CREAR PREFERENCIA
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

        metadata: { origen: 'appbar', tipo: 'entrada' },
      },
    })

    console.log('✅ RESULTADO PREFERENCIA:', result)

    return res.status(200).json({
      id: result.id ?? null,
      init_point: result.init_point ?? null,
      sandbox_init_point: result.sandbox_init_point ?? null,
    })
  } catch (error) {
    console.error('❌ ERROR AL CREAR PREFERENCIA:', error)

    return res.status(500).json({
      error: error.message,
      detalles: error,
    })
  }
}
