// --------------------------------------------------------------
// src/services/crearEntradaBase.js
// FACTORY ÚNICA DE ENTRADAS — FREE / MP / TRANSFERENCIA
// --------------------------------------------------------------

import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

/**
 * Crea una entrada normalizada en Firestore
 * @param {Object} params
 */
export async function crearEntradaBase({
  usuarioId,
  usuarioNombre,

  evento, // objeto evento COMPLETO (snapshot)
  lote = null, // objeto lote o null

  metodo = 'free', // free | mp | transferencia
  precioUnitario = 0,
  cantidad = 1,
  estado = 'aprobada', // aprobada | pendiente | cancelada
  qr = '',

  usado = false,
  loteIndice = null,
}) {
  // ----------------------------------------------------------
  // VALIDACIONES DURAS
  // ----------------------------------------------------------
  if (!usuarioId) throw new Error('usuarioId requerido')
  if (!evento?.id) throw new Error('evento inválido')
  if (!evento?.fechaInicio) throw new Error('evento.fechaInicio requerido')

  // ----------------------------------------------------------
  // SNAPSHOT EVENTO
  // ----------------------------------------------------------
  const eventoSnapshot = {
    eventoId: evento.id,
    nombreEvento: evento.nombre || '',
    lugar: evento.lugar || '',
    fechaEvento: evento.fechaInicio, // Timestamp
    horaInicio: evento.horaInicio || '',
    horaFin: evento.horaFin || '',
  }

  // ----------------------------------------------------------
  // SNAPSHOT LOTE (si existe)
  // ----------------------------------------------------------
  const loteSnapshot = lote
    ? {
        id: lote.id ?? lote.index ?? null,
        nombre: lote.nombre || '',
        descripcion: lote.descripcion || '',
        genero: lote.genero || 'todos',
        incluyeConsumicion: !!lote.incluyeConsumicion,
        desdeHora: lote.desdeHora || '',
        hastaHora: lote.hastaHora || '',
        precio: Number(precioUnitario) || 0,
      }
    : null

  // ----------------------------------------------------------
  // DOCUMENTO FINAL
  // ----------------------------------------------------------
  const entrada = {
    // Usuario
    usuarioId,
    usuarioNombre: usuarioNombre || '',

    // Evento
    ...eventoSnapshot,

    // Lote
    lote: loteSnapshot,
    loteIndice: Number.isFinite(loteIndice) ? loteIndice : null,

    // Compra
    metodo,
    precioUnitario: Number(precioUnitario) || 0,
    cantidad: Number(cantidad) || 1,
    total: Number(precioUnitario) * Number(cantidad),

    // Estado
    estado,
    usado: !!usado,

    // QR
    qr: qr || '',

    // Auditoría
    creadoEn: serverTimestamp(),
  }

  // ----------------------------------------------------------
  // GUARDAR
  // ----------------------------------------------------------
  return await addDoc(collection(db, 'entradas'), entrada)
}
