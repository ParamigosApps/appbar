// --------------------------------------------------------------
// utils/calcularDisponiblesAhora.js — PASSLINE PRO 2025
// --------------------------------------------------------------

export function calcularDisponiblesAhora({
  evento,
  limiteUsuario = 0,
  totalObtenidas = 0,
  totalPendientes = 0,
  cuposLote = 0,
  maxCantidad = Infinity,
}) {
  // ------------------------------------------------------------
  // 1️⃣ Límite por evento (fuente única de verdad)
  // ------------------------------------------------------------
  const limiteEvento =
    Number(evento?.entradasPorUsuario) > 0
      ? Number(evento.entradasPorUsuario)
      : Infinity

  // ------------------------------------------------------------
  // 2️⃣ Override opcional por flujo
  // ------------------------------------------------------------
  const limiteReal = limiteUsuario > 0 ? limiteUsuario : limiteEvento

  // ------------------------------------------------------------
  // 3️⃣ Disponibles reales para el usuario
  // ------------------------------------------------------------
  const disponiblesPorUsuario = limiteReal - totalObtenidas - totalPendientes

  // ------------------------------------------------------------
  // 4️⃣ Cupos reales del lote
  // ------------------------------------------------------------
  const cuposReales = Number(cuposLote) > 0 ? Number(cuposLote) : Infinity

  // ------------------------------------------------------------
  // 5️⃣ Resultado final blindado
  // ------------------------------------------------------------
  return Math.max(0, Math.min(disponiblesPorUsuario, cuposReales, maxCantidad))
}
