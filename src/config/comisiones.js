// src/config/comisiones.js

export const COMISION_DEFAULT_ENTRADA = 1

export function obtenerComisionEntrada({ evento, lote } = {}) {
  // 🔹 prioridad: evento > lote > default
  if (Number.isFinite(evento?.comisionPorEntrada)) {
    return Number(evento.comisionPorEntrada)
  }

  if (Number.isFinite(lote?.comisionPorEntrada)) {
    return Number(lote.comisionPorEntrada)
  }

  return COMISION_DEFAULT_ENTRADA
}
