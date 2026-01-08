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

  // 6) CUPOS POR LOTE (FINAL: cantidadDisponible + cantidadUsada)
  const lotesInfo = lotes.map((lote, index) => {
    // Vendidas / pendientes del lote (GLOBAL)
    const vendidasGlobal = vendidasSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )

    const pendientesGlobal = pendientesSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + Number(d.data().cantidad || 1) : a,
      0
    )

    // ✅ Total base (100%) del lote:
    // - prioridad: cantidadInicial
    // - fallback: cantidad (si algún evento viejo no tenía cantidadInicial)
    const cantidadInicial = Number(lote.cantidadInicial ?? lote.cantidad ?? 0)

    // ✅ Este es el dato derivado clave
    const cantidadUsada = Math.max(0, vendidasGlobal + pendientesGlobal)

    // ✅ Disponibles reales ahora
    const cantidadDisponible = Math.max(0, cantidadInicial - cantidadUsada)

    // Entradas del usuario en este lote (para límites)
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

    const limiteLote = Number(lote.maxPorUsuario) || Infinity
    const disponiblesPorLoteUsuario = Math.max(0, limiteLote - totalUsuarioLote)

    // ✅ Lo que este usuario puede seleccionar hoy
    const disponiblesUsuario = Math.max(
      0,
      Math.min(cantidadDisponible, disponiblesPorLoteUsuario)
    )

    return {
      ...lote,
      index,

      // 🔒 Modelo nuevo (clarísimo)
      cantidadInicial,
      cantidadUsada,
      cantidadDisponible,

      // 🔐 Límite por usuario (para el select)
      disponiblesUsuario,

      // métricas útiles (opcional)
      vendidasGlobal,
      pendientesGlobal,

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
