// --------------------------------------------------------------
// src/logic/entradas/entradasEventos.js — VERSIÓN CORREGIDA TOTAL 2025
// --------------------------------------------------------------

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'

// --------------------------------------------------------------
// CALCULAR CUPOS Y LÍMITES CORRECTOS
// --------------------------------------------------------------
export async function calcularCuposEvento(eventoId, usuarioId) {
  console.log('🟦 calcularCuposEvento()', { eventoId, usuarioId })

  // 1) Cargar evento
  const snap = await getDoc(doc(db, 'eventos', eventoId))
  if (!snap.exists()) throw new Error('Evento no encontrado')

  const evento = snap.data()
  const lotes = Array.isArray(evento.lotes) ? evento.lotes : []

  // 2) Límite por usuario
  const limitePorUsuario = Number(evento.entradasPorUsuario) || 1

  // 3) Entradas del evento
  const vendidasSnap = await getDocs(
    query(collection(db, 'entradas'), where('eventoId', '==', eventoId))
  )

  const pendientesSnap = await getDocs(
    query(
      collection(db, 'entradasPendientes'),
      where('eventoId', '==', eventoId)
    )
  )

  const totalVendidas = vendidasSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const totalPendientes = pendientesSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const cupoRestanteEvento =
    Number(evento.entradasMaximasEvento || Infinity) -
    (totalVendidas + totalPendientes)

  // 4) Entradas del usuario
  const userVendidas = vendidasSnap.docs.reduce(
    (a, d) =>
      d.data().usuarioId === usuarioId ? a + Number(d.data().cantidad || 1) : a,
    0
  )

  const userPendientes = pendientesSnap.docs.reduce(
    (a, d) =>
      d.data().usuarioId === usuarioId ? a + Number(d.data().cantidad || 1) : a,
    0
  )

  const totalUsuario = userVendidas + userPendientes

  // 5) Máximo REAL disponible para comprar HOY
  const maxUser = Math.max(
    0,
    Math.min(limitePorUsuario - totalUsuario, cupoRestanteEvento)
  )

  // 6) Cupos por lote
  const lotesInfo = lotes.map((lote, index) => {
    const vend = vendidasSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )
    const pend = pendientesSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )

    const restantes = Number(lote.cantidad || 0) - (vend + pend)

    return { ...lote, index, restantes }
  })

  return {
    eventoData: evento,
    limitePorUsuario,
    totalUsuario,
    maxUser,
    lotesInfo,
  }
}
