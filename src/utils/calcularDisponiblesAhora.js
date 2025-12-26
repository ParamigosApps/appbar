// --------------------------------------------------------------
// utils/calcularDisponiblesAhora.js — PASSLINE PRO 2025
// --------------------------------------------------------------

export function calcularDisponiblesAhora({
  evento,
  limiteUsuario = 0,
  totalObtenidas = 0,
  totalPendientes = 0,
  cuposLote = Infinity,
  maxCantidad = Infinity,
}) {
  // ------------------------------------------------------------
  // 1️⃣ Límite por evento
  // ------------------------------------------------------------
  const limiteEvento =
    Number(evento?.entradasPorUsuario) > 0
      ? Number(evento.entradasPorUsuario)
      : Infinity

  // ------------------------------------------------------------
  // 2️⃣ Límite real (override solo si viene explícito)
  // ------------------------------------------------------------
  const limiteReal =
    Number(limiteUsuario) > 0 ? Number(limiteUsuario) : limiteEvento

  // ------------------------------------------------------------
  // 3️⃣ Disponible por usuario
  // ------------------------------------------------------------
  const disponiblesPorUsuario =
    limiteReal === Infinity
      ? Infinity
      : Math.max(limiteReal - totalObtenidas - totalPendientes, 0)

  // ------------------------------------------------------------
  // 4️⃣ Disponible por lote (YA ES RESTANTE GLOBAL)
  // ------------------------------------------------------------
  const disponiblesPorLote = Number.isFinite(cuposLote)
    ? Math.max(cuposLote, 0)
    : Infinity

  // ------------------------------------------------------------
  // 5️⃣ Resultado final
  // ------------------------------------------------------------
  return Math.max(
    0,
    Math.min(disponiblesPorUsuario, disponiblesPorLote, maxCantidad)
  )
}
