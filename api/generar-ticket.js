import { Resend } from 'resend'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../src/Firebase.js'

import { mailPedido } from '../src/services/mailTemplates.js'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pedidoId, to, nombre } = req.body

    // -----------------------------
    // Validaciones básicas
    // -----------------------------
    if (!pedidoId || !to) {
      return res.status(400).json({ error: 'Missing pedidoId or email' })
    }

    // -----------------------------
    // 🔒 Leer pedido REAL desde Firestore
    // -----------------------------
    const ref = doc(db, 'compras', pedidoId)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return res.status(404).json({ error: 'Pedido no encontrado' })
    }

    const pedido = snap.data()

    // -----------------------------
    // ⛔ Seguridad mínima
    // -----------------------------
    if (pedido.estado !== 'pagado') {
      return res.status(403).json({ error: 'Pedido no pagado' })
    }

    // -----------------------------
    // ✉️ Enviar mail con adjunto
    // -----------------------------
    const data = await resend.emails.send({
      from: 'AppBar <onboarding@resend.dev>',
      to,
      subject: `🧾 Pedido #${pedido.numeroPedido}`,
      html: mailPedido({
        nombre: pedido.usuarioNombre || nombre || 'Cliente',
        numeroPedido: pedido.numeroPedido,
        total: pedido.total,
        lugar: pedido.lugar,
        fecha: pedido.creadoEn?.toDate().toLocaleString('es-AR'),
        qrBase64: pedido.qrBase64,
        linkPedido: 'https://tu-dominio.com/mis-compras',
      }),
    })

    return res.status(200).json({ ok: true, data })
  } catch (err) {
    console.error('❌ GENERAR TICKET ERROR:', err)

    return res.status(500).json({
      ok: false,
      error: err.message || 'Mail error',
    })
  }
}
