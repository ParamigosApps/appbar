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

  if (entradaBase.loteIndice !== undefined && entradaBase.loteIndice !== null) {
    filtros.push(where('loteIndice', '==', entradaBase.loteIndice))
  }

  const existentes = await getDocs(
    query(collection(db, 'entradasPendientes'), ...filtros)
  )

  // Si NO existe → crear nuevo documento
  if (existentes.empty) {
    return await addDoc(collection(db, 'entradasPendientes'), {
      eventoId,
      usuarioId,
      usuarioNombre: entradaBase.usuarioNombre || 'Usuario',
      eventoNombre: entradaBase.nombre,
      cantidad: entradaBase.cantidad,
      monto: entradaBase.cantidad * entradaBase.precio,
      estado: 'pendiente',
      creadaEn: new Date().toISOString(),
      fecha: entradaBase.fecha,
      lugar: entradaBase.lugar,
      horario: entradaBase.horario || 'A confirmar',
      precio: entradaBase.precio,
      loteIndice: entradaBase.loteIndice ?? null,
      loteNombre: entradaBase.loteNombre ?? null,
    })
  }

  // Si existe → actualizar cantidad y monto
  const ref = existentes.docs[0].ref
  const prev = existentes.docs[0].data().cantidad || 1
  const updated = prev + entradaBase.cantidad

  return updateDoc(ref, {
    cantidad: updated,
    monto: updated * entradaBase.precio,
    actualizadaEn: new Date().toISOString(),
  })
}
