import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, html } = req.body

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const data = await resend.emails.send({
      // from: process.env.MAIL_FROM,
      from: 'AppBar <onboarding@resend.dev>',
      to,
      subject,
      html,
    })

    return res.status(200).json({ ok: true, data })
  } catch (err) {
    console.error('SEND MAIL ERROR:', err)

    return res.status(500).json({
      ok: false,
      error: err.message || 'Mail error',
    })
  }
}
