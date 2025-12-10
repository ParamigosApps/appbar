// --------------------------------------------------------------
// entradasEventos.js — CUPOS + LOTES (USADO POR EntradasContext)
// --------------------------------------------------------------

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../Firebase'

// --------------------------------------------------------------
// Cargar un solo evento + calcular cupos totales
// --------------------------------------------------------------
export async function calcularCuposEvento(eventoId, usuarioId) {
  const eventoSnap = await getDoc(doc(db, 'eventos', eventoId))
  if (!eventoSnap.exists()) throw new Error('Evento no encontrado')

  const eventoData = eventoSnap.data()
  const lotes = Array.isArray(eventoData.lotes) ? eventoData.lotes : []

  // Entradas vendidas
  const vendidasSnap = await getDocs(
    query(collection(db, 'entradas'), where('eventoId', '==', eventoId))
  )

  // Entradas pendientes
  const pendientesSnap = await getDocs(
    query(
      collection(db, 'entradasPendientes'),
      where('eventoId', '==', eventoId)
    )
  )

  // Cupo total del evento
  const totalVendidas = vendidasSnap.docs.reduce(
    (a, d) => a + (d.data().cantidad || 1),
    0
  )
  const totalPend = pendientesSnap.docs.reduce(
    (a, d) => a + (d.data().cantidad || 1),
    0
  )

  const limiteEvento = eventoData.entradasMaximasEvento || null

  const cupoRestante = limiteEvento
    ? limiteEvento - (totalVendidas + totalPend)
    : Infinity

  // Cupo por usuario
  const limiteUsuario = eventoData.entradasPorUsuario || 4

  const userVend = vendidasSnap.docs.reduce(
    (a, d) => (d.data().usuarioId === usuarioId ? a + d.data().cantidad : a),
    0
  )
  const userPend = pendientesSnap.docs.reduce(
    (a, d) => (d.data().usuarioId === usuarioId ? a + d.data().cantidad : a),
    0
  )

  const maxUser = Math.min(limiteUsuario - (userVend + userPend), cupoRestante)

  // Procesar lotes
  const lotesInfo = prepararLotes(lotes, vendidasSnap, pendientesSnap)

  return { eventoData, cupoRestante, maxUser, lotesInfo }
}

// --------------------------------------------------------------
// Añadir restantes a cada lote
// --------------------------------------------------------------
export function prepararLotes(lotes, vendidasSnap, pendientesSnap) {
  if (!Array.isArray(lotes)) return []

  return lotes.map((l, index) => {
    const vend = vendidasSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + (d.data().cantidad || 1) : a,
      0
    )
    const pend = pendientesSnap.docs.reduce(
      (a, d) =>
        d.data().loteIndice === index ? a + (d.data().cantidad || 1) : a,
      0
    )

    const restantes = (Number(l.cantidad) || 0) - (vend + pend)

    return {
      ...l,
      index,
      restantes,
    }
  })
}
