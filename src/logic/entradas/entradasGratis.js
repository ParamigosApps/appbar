import { calcularCuposEvento } from '../entradas/entradasEventos.js'

import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'

function normalizarCantidad(cantidad, max = 9999) {
  let v = Number(cantidad)
  if (!Number.isFinite(v) || v < 1) v = 1
  if (v > max) v = max
  return v
}
export function esperarEntradasGeneradas({
  eventoId,
  usuarioId,
  cantidadEsperada,
  loteIndice,
}) {
  return new Promise(resolve => {
    const q = query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId),
      where('usuarioId', '==', usuarioId),
      ...(Number.isFinite(loteIndice)
        ? [where('loteIndice', '==', loteIndice)]
        : [])
    )

    const unsub = onSnapshot(q, snap => {
      const total = snap.docs.reduce(
        (a, d) => a + Number(d.data().cantidad || 1),
        0
      )

      if (total >= cantidadEsperada) {
        unsub()
        resolve(snap.docs.map(d => d.data()))
      }
    })
  })
}
export async function pedirEntradaFreeConLote({
  evento,
  loteSel,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  cantidadSel,
}) {
  if (!loteSel) {
    console.error('❌ loteSel es requerido para pedirEntradaFreeConLote')
    return
  }

  // 🔒 Validación UI (ANTI UX MALA, no seguridad)
  const { maxUser, lotesInfo } = await calcularCuposEvento(evento.id, usuarioId)

  const loteIndex = Number.isFinite(loteSel.index)
    ? loteSel.index
    : Number.isFinite(loteSel.loteIndice)
    ? loteSel.loteIndice
    : null

  const loteActual = lotesInfo.find(l => l.index === loteIndex)

  if (!loteActual || loteActual.restantes <= 0) {
    console.error('❌ Lote inválido o sin cupos restantes')
    return
  }

  const maxPermitido = Math.min(loteActual.restantes, maxUser)
  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)

  if (cantidad <= 0) {
    throw new Error('No tenés cupos disponibles para este lote')
  }

  await addDoc(collection(db, 'entradasGratisPendientes'), {
    eventoId: evento.id,
    loteIndice: loteIndex,
    cantidad,

    // 🔑 DUEÑO REAL
    usuarioId,
    usuarioNombre: usuarioNombre || '',
    usuarioEmail: usuarioEmail || '',

    creadoEn: serverTimestamp(),
    origen: 'frontend',
  })

  return {
    loteNombre: loteSel?.nombre || 'Entrada',
    cantidad,
  }
}

export async function pedirEntradaFreeSinLote({
  evento,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  cantidadSel,
}) {
  const { maxUser } = await calcularCuposEvento(evento.id, usuarioId)

  const cantidad = normalizarCantidad(cantidadSel, maxUser)

  if (cantidad <= 0) {
    throw new Error('No tenés cupos disponibles')
  }

  await addDoc(collection(db, 'entradasGratisPendientes'), {
    eventoId: evento.id,
    loteIndice: null,
    cantidad,
    usuarioId,
    usuarioNombre,
    usuarioEmail,
    creadoEn: serverTimestamp(),
    origen: 'frontend',
  })

  return {
    loteNombre: 'Entrada general',
    cantidad,
  }
}

export async function entregarEntradasGratisPostPago({
  evento,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  entradasGratisPendientes,
}) {
  if (!Array.isArray(entradasGratisPendientes)) return []

  const resultados = []

  for (const g of entradasGratisPendientes) {
    const r = g.lote
      ? await pedirEntradaFreeConLote({
          evento,
          loteSel: g.lote,
          usuarioId,
          usuarioNombre,
          usuarioEmail,
          cantidadSel: g.cantidad,
        })
      : await pedirEntradaFreeSinLote({
          evento,
          usuarioId,
          usuarioNombre,
          usuarioEmail,
          cantidadSel: g.cantidad,
        })

    if (r) resultados.push(r)
  }

  return resultados
}
