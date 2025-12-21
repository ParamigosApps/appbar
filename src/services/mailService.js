// --------------------------------------------------------------
// mailService.js — SERVICIO CENTRALIZADO DE MAILS
// --------------------------------------------------------------

export async function enviarMail({ to, subject, html, silent = false }) {
  try {
    if (!silent) console.log('📧 ENVIANDO MAIL:', subject)

    const res = await fetch('/api/sendMail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Error enviando mail')
    }

    if (!silent) console.log('✅ MAIL ENVIADO')

    return await res.json()
  } catch (e) {
    console.error('❌ ERROR ENVIANDO MAIL', e)
    throw e
  }
}
