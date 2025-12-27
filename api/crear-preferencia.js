import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  console.log('🔵 /api/crear-preferencia INICIADA')

  // ======================================================
  // LEER RAW BODY (requerido en Vercel)
  // ======================================================
  let rawBody = ''
  await new Promise(resolve => {
    req.on('data', chunk => (rawBody += chunk))
    req.on('end', resolve)
  })

  let body
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error('❌ JSON inválido:', err)
    return res.status(400).json({ error: 'JSON inválido' })
  }

  // ======================================================
  // TOKEN MP (PRODUCCIÓN)
  // ======================================================
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

  if (!ACCESS_TOKEN) {
    console.error('❌ MP_ACCESS_TOKEN no configurado')
    return res.status(500).json({
      error: 'MP_ACCESS_TOKEN no configurado',
    })
  }

  const client = new MercadoPagoConfig({
    accessToken: ACCESS_TOKEN, // 🔑 APP_USR_...
  })

  const preference = new Preference(client)

  // ======================================================
  // ITEMS (VALIDACIÓN FUERTE)
  // ======================================================
  let items = Array.isArray(body.items) ? body.items : []

  if (items.length === 0) {
    items = [
      {
        title: body.title || 'Entrada',
        quantity: Number(body.quantity ?? 1),
        unit_price: Number(body.unit_price ?? body.price ?? 0),
        currency_id: 'ARS',
        picture_url: body.imagenEventoUrl || '',
      },
    ]
  }

  items = items.map(i => ({
    title: String(i.title),
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    currency_id: 'ARS',
    picture_url: i.picture_url || '',
  }))

  // Validación final (evita errores silenciosos)
  for (const i of items) {
    if (
      !i.title ||
      !Number.isInteger(i.quantity) ||
      i.quantity <= 0 ||
      !Number.isFinite(i.unit_price) ||
      i.unit_price <= 0
    ) {
      return res.status(400).json({
        error: 'Item inválido',
        item: i,
      })
    }
  }

  console.log('📦 ITEMS PRODUCCIÓN:', items)

  const baseUrl =
    'https://appbar-88phi9hta-ivan-ruizs-projects-c453caf9.vercel.app'

  // ======================================================
  // CREAR PREFERENCIA (PRODUCCIÓN REAL)
  // ======================================================
  try {
    const pref = await preference.create({
      body: {
        items,

        external_reference: body.external_reference || null,

        back_urls: {
          success: `${baseUrl}/pago-resultado?status=success`,
          failure: `${baseUrl}/pago-resultado?status=failure`,
          pending: `${baseUrl}/pago-resultado?status=pending`,
        },

        auto_return: 'approved',
      },
    })

    console.log('🟢 MP OK:', {
      id: pref.id,
      init_point: pref.init_point,
    })

    // 🔥 SOLO PRODUCCIÓN (NO sandbox)
    return res.status(200).json({
      id: pref.id,
      init_point: pref.init_point,
    })
  } catch (error) {
    console.error('❌ ERROR MERCADO PAGO:', error)

    return res.status(500).json({
      error: 'Error al crear preferencia Mercado Pago',
      detalle: error?.message || null,
    })
  }
}
