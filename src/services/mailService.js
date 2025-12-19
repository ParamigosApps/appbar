export async function enviarMail({ to, subject, html }) {
  const res = await fetch('/api/sendMail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
  })

  if (!res.ok) {
    throw new Error('Error enviando mail')
  }

  return await res.json()
}
