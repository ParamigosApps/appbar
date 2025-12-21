// --------------------------------------------------------------
// QR FIRMA — ANTI FRAUDE
// --------------------------------------------------------------

const SECRET = 'APPBAR_QR_SECRET_2025' // ⚠️ mover a ENV en prod

export function firmarQr(ticketId) {
  const base = `${ticketId}|${SECRET}`
  return btoa(base).replace(/=/g, '')
}

export function verificarFirma(ticketId, firma) {
  return firmarQr(ticketId) === firma
}
