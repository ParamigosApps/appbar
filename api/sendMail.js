import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, subject, html } = req.body

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  try {
    const data = await resend.emails.send({
      from: process.env.MAIL_FROM, // AppBar <noreply@mail.todovaper.com.ar>
      to,
      subject,
      html,
    })

    return res.status(200).json({ ok: true, data })
  } catch (err) {
    console.error('MAIL ERROR:', err)
    return res.status(500).json({ error: 'Error enviando mail' })
  }
}
