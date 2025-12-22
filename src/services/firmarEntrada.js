// --------------------------------------------------------------
// src/services/firmarEntrada.js
// --------------------------------------------------------------

// 🔐 IMPORTANTE:
// Este secret NO se expone al usuario.
// Cambialo solo si querés invalidar todos los QRs viejos.
const SECRET_QR = 'APPBAR_QR_2025'

export function firmarEntradaCorta(entradaId) {
  if (!entradaId) return null

  // Hash simple, corto y suficiente
  let hash = 0
  const str = entradaId + SECRET_QR

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // 32-bit
  }

  // Base36 → letras + números, más corto
  return Math.abs(hash).toString(36).slice(0, 6)
}
