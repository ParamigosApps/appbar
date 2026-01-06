// --------------------------------------------------------------
// utils/calcularDisponiblesAhora.js — PASSLINE PRO 2025 (SYNC)
// --------------------------------------------------------------

export function calcularDisponiblesAhora({
  evento,
  hayLotes = false,
  limiteUsuario = 0,
  totalObtenidas = 0,
  totalPendientes = 0,
  cuposLote = Infinity,
  maxCantidad = Infinity,
}) {
  // ------------------------------------------------------------
  // 1️⃣ Límite efectivo
  // - Con lotes: SOLO manda el lote
  // - Sin lotes: manda el evento
  // ------------------------------------------------------------
  let limiteEfectivo

  if (hayLotes === true) {
    // 🔒 JAMÁS mirar el evento cuando hay lotes
    limiteEfectivo =
      Number.isFinite(limiteUsuario) && limiteUsuario > 0
        ? Number(limiteUsuario)
        : Infinity
  } else {
    limiteEfectivo =
      Number.isFinite(evento?.entradasPorUsuario) &&
      evento.entradasPorUsuario > 0
        ? Number(evento.entradasPorUsuario)
        : Infinity
  }

  // ------------------------------------------------------------
  // 2️⃣ Disponible por usuario
  // ------------------------------------------------------------
  const usados = Number(totalObtenidas || 0) + Number(totalPendientes || 0)

  const disponiblesPorUsuario =
    limiteEfectivo === Infinity
      ? Infinity
      : Math.max(limiteEfectivo - usados, 0)

  // ------------------------------------------------------------
  // 3️⃣ Disponible por lote (global)
  // ------------------------------------------------------------
  const disponiblesPorLote =
    Number.isFinite(cuposLote) && cuposLote >= 0 ? Number(cuposLote) : Infinity

  // ------------------------------------------------------------
  // 4️⃣ Resultado final
  // ------------------------------------------------------------

  if (hayLotes === true) {
    // evento queda TOTALMENTE ignorado
    return Math.max(
      0,
      Math.min(
        Number.isFinite(limiteUsuario) && limiteUsuario > 0
          ? limiteUsuario - usados
          : Infinity,
        disponiblesPorLote
      )
    )
  }

  return Math.max(0, Math.min(disponiblesPorUsuario, maxCantidad))
}
