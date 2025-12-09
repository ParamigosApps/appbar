import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  console.log('🔵 API /crear-preferencia INICIADA')

  // ===============================
  // LEER RAW BODY
  // ===============================
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

  // ===============================
  // VALIDAR TOKEN MP
  // ===============================
  console.log('🔑 TOKEN MP PRESENTE?', !!process.env.MP_ACCESS_TOKEN)

  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN' })
  }

  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
  })

  // ===============================
  // NORMALIZAR ITEMS
  // ===============================
  let items = body.items

  if (!Array.isArray(items)) {
    console.log('⚠ items NO vino → generando item único…')

    items = [
      {
        title: body.title || 'Entrada',
        quantity: Number(body.quantity ?? 1),
        unit_price: Number(body.unit_price ?? body.price ?? 0),
        currency_id: 'ARS',
        description: body.description || body.title || '',
        picture_url: body.picture_url ?? body.imagenEventoUrl ?? '',
      },
    ]
  }

  console.log('📦 ITEMS FINALES:', items)

  const BASE_URL = 'https://appbar-react-final.vercel.app'

  const preference = new Preference(client)

  try {
    // ===============================
    // CREAR PREFERENCIA SANDBOX
    // ===============================
    console.log('🚀 Enviando preferencia a Mercado Pago…')

    const result = await preference.create({
      body: {
        items,
        external_reference: body.external_reference || null,
        auto_return: 'approved',

        back_urls: {
          success: `${BASE_URL}/pago-exitoso.html`,
          failure: `${BASE_URL}/pago-fallido.html`,
          pending: `${BASE_URL}/pago-pendiente.html`,
        },

        metadata: { sandbox: true },
      },
    })

    console.log('✅ PREFERENCIA CREADA:', result)

    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    })
  } catch (error) {
    console.error('❌ ERROR CREANDO PREFERENCIA:', error)

    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    })
  }
}
