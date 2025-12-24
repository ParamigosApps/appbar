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
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'

// --------------------------------------------------------------
// 🔹 Obtener datos bancarios
// --------------------------------------------------------------
export async function obtenerDatosBancarios() {
  const ref = doc(db, 'configuracion', 'datosBancarios')
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : {}
  return data
}

// --------------------------------------------------------------
// 🔹 Obtener redes / contacto
// --------------------------------------------------------------
export async function obtenerContacto() {
  const ref = doc(db, 'configuracion', 'social')
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : null
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
// 🔥 CREAR / ACTUALIZAR SOLICITUD PENDIENTE (transferencia)
// --------------------------------------------------------------
export async function crearSolicitudPendiente(
  eventoId,
  usuarioId,
  entradaBase
) {
  const loteIndice = Number.isFinite(entradaBase.loteIndice)
    ? entradaBase.loteIndice
    : Number.isFinite(entradaBase.lote?.index)
    ? entradaBase.lote.index
    : null

  if (entradaBase.lote && !Number.isFinite(loteIndice)) {
    console.error('❌ Entrada pendiente sin loteIndice', entradaBase)
    throw new Error('Entrada inválida: falta loteIndice')
  }

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
  // 🧠 DATA BASE
  // ----------------------------------------------------------
  const dataBase = {
    eventoId,
    eventoNombre: entradaBase.eventoNombre,

    usuarioId,
    usuarioNombre: entradaBase.usuarioNombre || 'Usuario',

    cantidad,
    precioUnitario,
    monto: cantidad * precioUnitario,

    loteIndice,

    lote: entradaBase.lote
      ? {
          id: entradaBase.lote.id || null,
          nombre: entradaBase.lote.nombre,
          precio: precioUnitario,
          incluyeConsumicion: !!entradaBase.lote.incluyeConsumicion,
          genero: entradaBase.lote.genero || 'todos',
        }
      : null,

    loteNombre: entradaBase.lote?.nombre ?? 'Entrada general',

    metodo: 'transferencia',
    estado: 'pendiente',

    fechaEvento: entradaBase.fechaEvento,
    horaInicio: entradaBase.horaInicio,
    horaFin: entradaBase.horaFin,
    lugar: entradaBase.lugar,

    // 🔥 CLAVE PARA ADMIN
    ultimaModificacionPor: 'usuario',
    ultimaModificacionEn: serverTimestamp(),

    creadoEn: serverTimestamp(),
  }

  // 🧹 LIMPIEZA
  Object.keys(dataBase).forEach(k => {
    if (dataBase[k] === undefined) delete dataBase[k]
  })

  // ----------------------------------------------------------
  // ➕ CREAR
  // ----------------------------------------------------------
  if (existentes.empty) {
    return await addDoc(collection(db, 'entradasPendientes'), dataBase)
  }

  // ----------------------------------------------------------
  // 🔁 ACTUALIZAR (usuario agregó más entradas)
  // ----------------------------------------------------------
  const ref = existentes.docs[0].ref
  const prev = Number(existentes.docs[0].data().cantidad) || 1
  const updated = prev + cantidad

  return updateDoc(ref, {
    cantidad: updated,
    monto: updated * precioUnitario,

    // 🔥 CLAVE PARA ADMIN
    ultimaModificacionPor: 'usuario',
    ultimaModificacionEn: serverTimestamp(),

    actualizadaEn: serverTimestamp(),
  })
}

export async function obtenerTotalPendientes({
  eventoId,
  usuarioId,
  loteId = null,
}) {
  if (!eventoId || !usuarioId) return 0

  const filtros = [
    where('eventoId', '==', eventoId),
    where('usuarioId', '==', usuarioId),
  ]

  if (loteId) {
    filtros.push(where('lote.id', '==', loteId))
  }

  const q = query(collection(db, 'entradasPendientes'), ...filtros)

  const snap = await getDocs(q)

  return snap.size
}
