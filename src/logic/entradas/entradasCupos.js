// --------------------------------------------------
// entradasCupos.js — STUB SEGURO (PRODUCCIÓN)
// --------------------------------------------------

// ⚠️ Versión mínima para no romper flujos
// Luego se puede extender con cupos reales por lote

/**
 * Valida cupos disponibles para un evento o lote
 * @returns {boolean} siempre true por ahora
 */
export async function validarCupoDisponible({
  eventoId,
  loteIndice,
  cantidad = 1,
}) {
  return true
}

/**
 * Descuenta cupos (stub)
 * Se deja preparado para futura lógica real
 */
export async function descontarCupos({ eventoId, loteIndice, cantidad = 1 }) {
  return true
}

/**
 * Devuelve cupos restantes (stub)
 */
export async function obtenerCuposRestantes({ eventoId, loteIndice }) {
  return Infinity
}
