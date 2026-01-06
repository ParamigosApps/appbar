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

export async function calcularCuposEvento(eventoId, usuarioId) {
  // 1) Cargar evento
  const snap = await getDoc(doc(db, 'eventos', eventoId))
  if (!snap.exists()) throw new Error('Evento no encontrado')

  const evento = snap.data()
  const lotes = Array.isArray(evento.lotes) ? evento.lotes : []

  // 2) Límite por usuario (GLOBAL EVENTO)
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

  // 4) Entradas del usuario (GLOBAL EVENTO)
  const userVendidasSnap = await getDocs(
    query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId),
      where('usuarioId', '==', usuarioId)
    )
  )

  const userPendientesSnap = await getDocs(
    query(
      collection(db, 'entradasPendientes'),
      where('eventoId', '==', eventoId),
      where('usuarioId', '==', usuarioId)
    )
  )

  const userVendidas = userVendidasSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const userPendientes = userPendientesSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const totalUsuario = userVendidas + userPendientes

  // 5) Máximo GLOBAL que el usuario todavía puede sacar
  const maxUser = Math.max(
    0,
    Math.min(limitePorUsuario - totalUsuario, cupoRestanteEvento)
  )

  // 6) CUPOS POR LOTE (CORRECTO)
  const lotesInfo = lotes.map((lote, index) => {
    // Vendidas / pendientes del lote (GLOBAL)
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

    const restantesLote = Math.max(
      Number(lote.cantidad || 0) - (vend + pend),
      0
    )

    // 🔥 NUEVO: entradas del USUARIO en este lote
    const userVendidasLote = userVendidasSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )

    const userPendientesLote = userPendientesSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )

    const totalUsuarioLote = userVendidasLote + userPendientesLote

    // 🔐 Límite por usuario del LOTE
    const limiteLote = Number(lote.maxPorUsuario) || Infinity

    const disponiblesPorLoteUsuario = Math.max(0, limiteLote - totalUsuarioLote)

    // 🔑 DISPONIBLE FINAL REAL
    const disponiblesFinal = Math.max(
      0,
      Math.min(restantesLote, disponiblesPorLoteUsuario)
    )

    return {
      ...lote,
      index,

      // 🔑 CLAVE: el Swal usa `cantidad`
      cantidad: disponiblesFinal,

      // extras (debug / admin)
      restantesLote,
      maxPorUsuario: Number(lote.maxPorUsuario) || 0,
      totalUsuarioLote,
    }
  })

  return {
    eventoData: evento,
    limitePorUsuario,
    totalUsuario,
    maxUser,
    lotesInfo,
  }
}
