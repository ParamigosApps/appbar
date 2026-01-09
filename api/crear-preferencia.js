import { MercadoPagoConfig, Preference } from 'mercadopago'

export const config = { runtime: 'nodejs' }

function safeStr(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function safeNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export default async function handler(req, res) {
  const reqId = `pref_${Date.now()}_${Math.random().toString(16).slice(2)}`

  if (req.method === 'GET') {
    return res.status(200).send('ok')
  }

  if (req.method !== 'POST') {
    return res.status(200).send('ignored')
  }

  const body = req.body
  if (!body || typeof body !== 'object') {
    console.log(`❌ [${reqId}] body inválido`, { bodyType: typeof body })
    return res.status(400).json({ error: 'Body inválido' })
  }
  const breakdown = body.breakdown || null

  const external_reference = safeStr(body.external_reference)
  if (!external_reference) {
    console.log(`❌ [${reqId}] falta external_reference`)
    return res.status(400).json({ error: 'external_reference es obligatoria' })
  }

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  if (!ACCESS_TOKEN) {
    console.log(`❌ [${reqId}] MP_ACCESS_TOKEN faltante`)
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' })
  }

  const baseUrl = process.env.PUBLIC_BASE_URL
  if (!baseUrl) {
    console.log(`❌ [${reqId}] PUBLIC_BASE_URL faltante`)
    return res.status(500).json({ error: 'PUBLIC_BASE_URL no configurada' })
  }

  let items = Array.isArray(body.items) ? body.items : []

  if (items.length === 0) {
    items = [
      {
        id: body.itemId || 'entrada_general',
        title: body.title || 'Entrada',
        description: body.description || 'Entrada para evento',
        quantity: Number(body.quantity ?? 1),
        unit_price: Number(body.unit_price ?? body.price ?? 0),
        currency_id: 'ARS',
        category_id: 'tickets',
        picture_url: body.imagenEventoUrl || '',
      },
    ]
  }

  items = items.map((i, idx) => {
    const title = safeStr(i.title, 'Entrada')
    const id = safeStr(i.id, `item_${idx + 1}_${title.replace(/\s+/g, '_')}`)
    const category_id = safeStr(i.category_id, 'tickets')
    const description = safeStr(
      i.description,
      `Compra: ${title} (evento/entrada)`
    )

    return {
      id,
      title,
      description, // ✅ recomendado por MP
      quantity: Number(i.quantity ?? 1),
      unit_price: safeNum(i.unit_price ?? i.price ?? 0),
      currency_id: safeStr(i.currency_id, 'ARS'),
      category_id, // ✅ recomendado por MP
      picture_url: safeStr(i.picture_url || '', ''),
    }
  })

  // Validar items
  for (const it of items) {
    if (
      !it.id ||
      !it.title ||
      !it.description ||
      !Number.isInteger(it.quantity) ||
      it.quantity <= 0 ||
      !Number.isFinite(it.unit_price) ||
      it.unit_price <= 0 ||
      !it.category_id
    ) {
      console.log(`❌ [${reqId}] item inválido`, it)
      return res.status(400).json({ error: 'Item inválido', item: it })
    }
  }

  // Payer recomendado (ANTI-FRAUDE)
  const payer = {
    first_name: safeStr(body.usuarioNombre, 'Cliente'),
    last_name: safeStr(body.usuarioApellido, 'App'),
    email: safeStr(body.usuarioEmail, 'no-reply@app.com'),
  }

  console.log(`🧾 [${reqId}] payload armado`, {
    external_reference,
    payer: {
      first_name: payer.first_name,
      last_name: payer.last_name,
      email: payer.email ? '***' : '',
    },
    items: items.map(i => ({
      id: i.id,
      title: i.title,
      category_id: i.category_id,
      hasDescription: !!i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
    notification_url: `${baseUrl}/api/webhook-mp`,
  })

  try {
    const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN })
    const preference = new Preference(client)

    let calcTotal = 0

    for (const it of items) {
      calcTotal += it.unit_price * it.quantity
    }
    if (breakdown) {
      const declaredTotal = safeNum(breakdown.total)
      const declaredBase = safeNum(breakdown.totalBase)
      const declaredComision = safeNum(breakdown.totalComision)

      if (
        declaredTotal !== calcTotal ||
        declaredBase + declaredComision !== calcTotal
      ) {
        console.log(`❌ [${reqId}] breakdown inconsistente`, {
          declaredTotal,
          declaredBase,
          declaredComision,
          calcTotal,
        })

        return res.status(400).json({
          error: 'Breakdown inconsistente',
        })
      }
    }

    const pref = await preference.create({
      body: {
        external_reference,
        items,
        payer,

        metadata: breakdown
          ? {
              tipo: 'entrada',
              eventoId: body.eventoId || null,
              totalBase: breakdown.totalBase,
              totalComision: breakdown.totalComision,
              comisionPorEntrada: breakdown.comisionPorEntrada,
            }
          : undefined,

        statement_descriptor: 'APPBAR EVENTOS',

        notification_url: `${baseUrl}/api/webhook-mp`,

        back_urls: {
          success: `${baseUrl}/pago-resultado?status=success`,
          failure: `${baseUrl}/pago-resultado?status=failure`,
          pending: `${baseUrl}/pago-resultado?status=pending`,
        },

        auto_return: 'approved',
      },
    })

    console.log(`🟢 [${reqId}] MP preferencia OK`, {
      id: pref?.id,
      hasInitPoint: !!pref?.init_point,
    })

    return res.status(200).json({
      id: pref.id,
      init_point: pref.init_point,
    })
  } catch (error) {
    // IMPORTANTE: log con información útil
    console.error(`❌ [${reqId}] MP create preference ERROR`, {
      message: error?.message,
      cause: error?.cause,
      status: error?.status,
      response: error?.response?.data,
    })

    return res.status(500).json({
      error: 'Error al crear preferencia Mercado Pago',
      detalle: error?.message || null,
    })
  }
}
