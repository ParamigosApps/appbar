// --------------------------------------------------------------
// utils/calcularDisponiblesAhora.js — PASSLINE PRO 2025 (SYNC)
// --------------------------------------------------------------

export function calcularDisponiblesAhora({
  evento,
  totalObtenidas = 0,
  totalPendientes = 0,
  maxCantidad = Infinity,
}) {
  const limiteEvento =
    Number.isFinite(evento?.entradasPorUsuario) && evento.entradasPorUsuario > 0
      ? Number(evento.entradasPorUsuario)
      : Infinity

  const usados = Number(totalObtenidas || 0) + Number(totalPendientes || 0)

  return Math.max(0, Math.min(limiteEvento - usados, maxCantidad))
}
