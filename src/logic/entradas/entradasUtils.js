// --------------------------------------------------------------
// src/logic/entradas/entradasUtils.js — HELPERS ENTRADAS
// --------------------------------------------------------------

import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'

// --------------------------------------------------------------
// 🔹 Obtener datos bancarios
// --------------------------------------------------------------
export async function obtenerDatosBancarios() {
  const ref = doc(db, 'configuracion', 'datosBancarios')
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : {}
  console.log('🏦 datosBancarios:', data)
  return data
}

// --------------------------------------------------------------
// 🔹 Obtener redes / contacto
// --------------------------------------------------------------
export async function obtenerContacto() {
  const ref = doc(db, 'configuracion', 'social')
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : null
  console.log('📲 contacto social:', data)
  return data
}

// --------------------------------------------------------------
// 🔹 Validar rango de cantidad
// --------------------------------------------------------------
export function clampCantidad(v, min, max) {
  v = Number(v)
  if (isNaN(v)) return min
  if (v < min) return min
  if (v > max) return max
  return v
}

// --------------------------------------------------------------
// 🔥 CREAR / ACTUALIZAR SOLICITUD PENDIENTE (transferencias)
// --------------------------------------------------------------
// --------------------------------------------------------------
// 🔥 CREAR / ACTUALIZAR SOLICITUD PENDIENTE (transferencia)
// --------------------------------------------------------------
export async function crearSolicitudPendiente(
  eventoId,
  usuarioId,
  entradaBase
) {
  console.log('🧾 crearSolicitudPendiente()', {
    eventoId,
    usuarioId,
    entradaBase,
  })

  const filtros = [
    where('eventoId', '==', eventoId),
    where('usuarioId', '==', usuarioId),
  ]

  if (entradaBase.lote?.id) {
    filtros.push(where('lote.id', '==', entradaBase.lote.id))
  }

  const existentes = await getDocs(
    query(collection(db, 'entradasPendientes'), ...filtros)
  )

  const cantidad = Number(entradaBase.cantidad) || 1
  const precioUnitario =
    Number(entradaBase.lote?.precio) ||
    Number(entradaBase.precioUnitario) ||
    Number(entradaBase.precio) ||
    0

  // ----------------------------------------------------------
  // 🧠 DATA BASE CORRECTA
  // ----------------------------------------------------------
  const dataBase = {
    eventoId,
    eventoNombre: entradaBase.eventoNombre,

    usuarioId,
    usuarioNombre: entradaBase.usuarioNombre || 'Usuario',

    cantidad,
    precioUnitario,
    monto: cantidad * precioUnitario,

    // 🟢 LOTE COMPLETO (CLAVE)
    lote: entradaBase.lote
      ? {
          id: entradaBase.lote.id || null,
          nombre: entradaBase.lote.nombre,
          precio: precioUnitario,
          incluyeConsumicion: !!entradaBase.lote.incluyeConsumicion,
          genero: entradaBase.lote.genero || 'todos',
        }
      : null,

    // legacy (no romper nada viejo)
    loteNombre: entradaBase.lote?.nombre ?? 'Entrada general',

    metodo: 'transferencia',
    estado: 'pendiente',

    fechaEvento: entradaBase.fechaEvento,
    horaInicio: entradaBase.horaInicio,
    horaFin: entradaBase.horaFin,
    lugar: entradaBase.lugar,

    creadoEn: new Date().toISOString(),
  }

  // 🛡️ LIMPIEZA
  Object.keys(dataBase).forEach(k => {
    if (dataBase[k] === undefined) delete dataBase[k]
  })

  // ----------------------------------------------------------
  // ➕ CREAR O ACTUALIZAR
  // ----------------------------------------------------------
  if (existentes.empty) {
    return await addDoc(collection(db, 'entradasPendientes'), dataBase)
  }

  const ref = existentes.docs[0].ref
  const prev = Number(existentes.docs[0].data().cantidad) || 1
  const updated = prev + cantidad

  return updateDoc(ref, {
    cantidad: updated,
    monto: updated * precioUnitario,
    actualizadaEn: new Date().toISOString(),
  })
}
