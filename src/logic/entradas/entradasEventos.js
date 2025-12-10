// --------------------------------------------------------------
// src/logic/entradas/entradasEventos.js — DEBUG ULTRA PRO
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
// CALCULAR CUPOS Y LÍMITES — VERSIÓN DEBUG 2025
// --------------------------------------------------------------
export async function calcularCuposEvento(eventoId, usuarioId) {
  console.log('══════════════════════════════════════════')
  console.log('🔵 calcularCuposEvento() INICIO')
  console.log('eventoId:', eventoId, 'usuarioId:', usuarioId)
  console.log('══════════════════════════════════════════')

  // 1) Traer evento
  const eventoSnap = await getDoc(doc(db, 'eventos', eventoId))
  if (!eventoSnap.exists()) throw new Error('Evento no encontrado')

  const eventoData = eventoSnap.data()

  console.log('📌 EVENTO DATA COMPLETO:', JSON.stringify(eventoData, null, 2))

  // LOTES
  const lotes = Array.isArray(eventoData.lotes) ? eventoData.lotes : []
  console.log('📦 LOTES BRUTOS:', lotes)

  // --------------------------------------------------------------
  // LÍMITES CONFIGURADOS
  // --------------------------------------------------------------
  const limitePorUsuario =
    Number(eventoData.entradasPorUsuario) ||
    Number(eventoData.maxEntradasUsuario) ||
    1

  const limiteEvento =
    Number(eventoData.entradasMaximasEvento) ||
    Number(eventoData.maxEntradasEvento) ||
    Infinity

  console.log('⚙️ LIMITES DETECTADOS:', {
    entradasPorUsuario: eventoData.entradasPorUsuario,
    maxEntradasUsuario: eventoData.maxEntradasUsuario,
    LIMITE_POR_USUARIO_FINAL: limitePorUsuario,
    LIMITE_EVENTO_FINAL: limiteEvento,
  })

  // --------------------------------------------------------------
  // CONSULTAR ENTRADAS VENDIDAS / PENDIENTES
  // --------------------------------------------------------------
  const vendidasSnap = await getDocs(
    query(collection(db, 'entradas'), where('eventoId', '==', eventoId))
  )

  const pendientesSnap = await getDocs(
    query(
      collection(db, 'entradasPendientes'),
      where('eventoId', '==', eventoId)
    )
  )

  console.log('📊 TOTAL DOCS VENDIDAS:', vendidasSnap.size)
  console.log('📊 TOTAL DOCS PENDIENTES:', pendientesSnap.size)

  // Totales del evento
  const totalVendidasEvento = vendidasSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const totalPendEvento = pendientesSnap.docs.reduce(
    (a, d) => a + Number(d.data().cantidad || 1),
    0
  )

  const cupoRestanteEvento =
    limiteEvento - (totalVendidasEvento + totalPendEvento)

  console.log('📉 CUPOS EVENTO:', {
    totalVendidasEvento,
    totalPendEvento,
    cupoRestanteEvento,
  })

  // --------------------------------------------------------------
  // CUPOS POR USUARIO
  // --------------------------------------------------------------
  const totalUsuarioVendidas = vendidasSnap.docs.reduce(
    (a, d) =>
      d.data().usuarioId === usuarioId ? a + Number(d.data().cantidad || 1) : a,
    0
  )

  const totalUsuarioPendientes = pendientesSnap.docs.reduce(
    (a, d) =>
      d.data().usuarioId === usuarioId ? a + Number(d.data().cantidad || 1) : a,
    0
  )

  const totalUsuario = totalUsuarioVendidas + totalUsuarioPendientes

  console.log('🧍 RESUMEN USUARIO:', {
    totalUsuarioVendidas,
    totalUsuarioPendientes,
    totalUsuario_TOTAL: totalUsuario,
  })

  // CALCULO FINAL DEL MAXIMO
  const maxUser = Math.max(
    0,
    Math.min(limitePorUsuario - totalUsuario, cupoRestanteEvento)
  )

  console.log('🚦 MAX USER CALCULADO:', {
    limitePorUsuario,
    totalUsuario,
    cupoRestanteEvento,
    RESULTADO: maxUser,
  })

  // --------------------------------------------------------------
  // CUPOS POR LOTE
  // --------------------------------------------------------------
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

    console.log(`📦 LOTE DEBUG #${index}`, {
      nombre: lote.nombre,
      cantidad: lote.cantidad,
      vend,
      pend,
      restantes,
    })

    return { ...lote, index, restantes }
  })

  console.log('📦 LOTES INFO FINAL:', lotesInfo)

  console.log('🔵 calcularCuposEvento() FIN')
  console.log('══════════════════════════════════════════')

  return {
    eventoData,
    limitePorUsuario,
    totalUsuario,
    cupoRestanteEvento,
    maxUser,
    lotesInfo,
  }
}
