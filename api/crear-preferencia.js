import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  console.log('🔵 /api/crear-preferencia INICIADA')

  // ======================================================
  // LEER RAW BODY (Vercel)
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

  if (!Array.isArray(items) || items.length === 0) {
    console.log('⚠ items no válidos → generando item único')

    items = [
      {
        title: body.title || 'Entrada',
        quantity: Number(body.quantity ?? 1),
        unit_price: Number(body.unit_price ?? body.price ?? 0),
        currency_id: 'ARS',
        picture_url: body.picture_url ?? body.imagenEventoUrl ?? '',
      },
    ]
  }

  // Validación fuerte (MP es estricto)
  items = items.map(i => ({
    title: String(i.title),
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    currency_id: 'ARS',
    picture_url: i.picture_url || '',
  }))

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

        external_reference: body.external_reference || null,

        payer:
          body.payer && typeof body.payer === 'object'
            ? body.payer
            : { email: 'test_user_123456@test.com' },

        back_urls: {
          success: `${BASE_URL}/pago-exitoso.html`,
          failure: `${BASE_URL}/pago-fallido.html`,
          pending: `${BASE_URL}/pago-pendiente.html`,
        },

        auto_return: 'approved',
      },
    })

    const pref = result

    console.log('🟦 RESULTADO MP REAL:', {
      id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
    })

    return res.status(200).json({
      id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
    })
  } catch (error) {
    console.error('❌ ERROR AL CREAR PREFERENCIA MP:', error)

    return res.status(500).json({
      error: error.message || 'Error Mercado Pago',
      detalles: error,
    })
  }
}
