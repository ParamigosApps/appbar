import { MercadoPagoConfig, Preference } from 'mercadopago'

export default async function handler(req, res) {
  // ======================================================
  // VALIDAR BODY
  // ======================================================
  const body = req.body

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body inválido' })
  }

  // ======================================================
  // external_reference OBLIGATORIA
  // ======================================================
  if (!body.external_reference) {
    return res.status(400).json({
      error: 'external_reference es obligatoria',
    })
  }

  // ======================================================
  // TOKEN MP
  // ======================================================
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  if (!ACCESS_TOKEN) {
    return res.status(500).json({
      error: 'MP_ACCESS_TOKEN no configurado',
    })
  }

  const client = new MercadoPagoConfig({
    accessToken: ACCESS_TOKEN,
  })

  const preference = new Preference(client)

  // ======================================================
  // ITEMS
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

  // ======================================================
  // BASE URL (DINÁMICA POR ENTORNO)
  // ======================================================
  const baseUrl = process.env.PUBLIC_BASE_URL

  if (!baseUrl) {
    return res.status(500).json({
      error: 'PUBLIC_BASE_URL no configurada',
    })
  }

  // ======================================================
  // CREAR PREFERENCIA
  // ======================================================
  try {
    const pref = await preference.create({
      body: {
        items,
        external_reference: body.external_reference,

        back_urls: {
          success: `${baseUrl}/pago-resultado?status=success`,
          failure: `${baseUrl}/pago-resultado?status=failure`,
          pending: `${baseUrl}/pago-resultado?status=pending`,
        },

        auto_return: 'approved',
      },
    })

    console.log('🟢 MP OK:', pref.id)

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
