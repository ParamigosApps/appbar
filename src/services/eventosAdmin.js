// --------------------------------------------------------------
// src/services/eventosAdmin.js — VERSIÓN FINAL PRO 2025 (FIXED)
// --------------------------------------------------------------

import { db, storage } from '../Firebase.js'

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  query,
  getDoc,
  Timestamp,
} from 'firebase/firestore'

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/* ============================================================
   🔵 SUBIR IMAGEN
============================================================ */
export async function subirImagenEvento(archivo) {
  try {
    const nombre = `eventos/${Date.now()}-${archivo.name}`
    const fileRef = ref(storage, nombre)
    await uploadBytes(fileRef, archivo)
    return await getDownloadURL(fileRef)
  } catch (err) {
    console.error('❌ Error al subir imagen:', err)
    return null
  }
}

/* ============================================================
   🔵 UTILS — CONVERTIR FECHA A TIMESTAMP
============================================================ */
function convertirFechaATimestamp(fecha, hora = '00:00') {
  if (!fecha) return null
  const date = new Date(`${fecha}T${hora || '00:00'}:00`)
  return Timestamp.fromDate(date)
}

/* ============================================================
   🔵 CREAR EVENTO (VERSIÓN FINAL SEGURA)
============================================================ */
export async function crearEvento(datos, imagenArchivo = null) {
  try {
    // 🔐 VALIDACIONES CLAVE
    if (!datos.nombre) throw new Error('Nombre requerido')
    if (!datos.fechaInicio) throw new Error('Fecha de inicio requerida')

    let imagenEventoUrl = ''

    if (imagenArchivo) {
      const url = await subirImagenEvento(imagenArchivo)
      if (url) imagenEventoUrl = url
    }

    const evento = {
      // Datos básicos
      nombre: datos.nombre.trim(),
      lugar: datos.lugar?.trim() || '',
      precio: Number(datos.precio) || 0,
      descripcion: datos.descripcion || '',

      // 🔑 FECHAS NORMALIZADAS (Timestamp)
      fechaInicio: convertirFechaATimestamp(
        datos.fechaInicio,
        datos.horaInicio
      ),

      fechaFin: datos.fechaFin
        ? convertirFechaATimestamp(datos.fechaFin, datos.horaFin)
        : null,

      // Horarios (solo informativos)
      horaInicio: datos.horaInicio || '',
      horaFin: datos.horaFin || '',

      // Capacidad
      entradasMaximasEvento: Number(datos.entradasMaximasEvento) || 0,
      entradasPorUsuario: Number(datos.entradasPorUsuario) || 1,

      // Lotes
      lotes: Array.isArray(datos.lotes) ? datos.lotes : [],

      // Imagen
      imagenEventoUrl,

      // Estado
      estado: 'activo',

      // Timestamps
      creadoEn: serverTimestamp(),
    }

    await addDoc(collection(db, 'eventos'), evento)
    return true
  } catch (err) {
    console.error('❌ Error al crear evento:', err.message || err)
    return false
  }
}

/* ============================================================
   🟣 EDITAR EVENTO
============================================================ */
export async function editarEvento(id, datos, imagenArchivo = null) {
  try {
    let imagenEventoUrl = datos.imagenEventoUrl || ''

    if (imagenArchivo) {
      const url = await subirImagenEvento(imagenArchivo)
      if (url) imagenEventoUrl = url
    }

    const nuevosDatos = {
      nombre: datos.nombre?.trim(),
      lugar: datos.lugar?.trim() || '',
      precio: Number(datos.precio) || 0,
      descripcion: datos.descripcion || '',

      fechaInicio: convertirFechaATimestamp(
        datos.fechaInicio,
        datos.horaInicio
      ),

      fechaFin: datos.fechaFin
        ? convertirFechaATimestamp(datos.fechaFin, datos.horaFin)
        : null,

      horaInicio: datos.horaInicio || '',
      horaFin: datos.horaFin || '',

      entradasMaximasEvento: Number(datos.entradasMaximasEvento) || 0,
      entradasPorUsuario: Number(datos.entradasPorUsuario) || 1,

      lotes: Array.isArray(datos.lotes) ? datos.lotes : [],

      imagenEventoUrl,

      actualizadoEn: serverTimestamp(),
    }

    await updateDoc(doc(db, 'eventos', id), nuevosDatos)
    return true
  } catch (err) {
    console.error('❌ Error al editar evento:', err)
    return false
  }
}

/* ============================================================
   🔴 ELIMINAR EVENTO
============================================================ */
export async function eliminarEvento(id) {
  try {
    await deleteDoc(doc(db, 'eventos', id))
    return true
  } catch (err) {
    console.error('❌ Error al eliminar evento:', err)
    return false
  }
}

/* ============================================================
   🟠 CANCELAR EVENTO
============================================================ */
export async function cancelarEvento(id, motivo = '') {
  try {
    await updateDoc(doc(db, 'eventos', id), {
      estado: 'cancelado',
      motivoCancelacion: motivo,
      canceladoEn: serverTimestamp(),
    })
    return true
  } catch (err) {
    console.error('❌ Error al cancelar evento:', err)
    return false
  }
}

/* ============================================================
   🔵 ESCUCHAR EVENTOS (ORDEN FECHA)
============================================================ */
export function escucharEventos(callback) {
  const q = query(collection(db, 'eventos'), orderBy('fechaInicio', 'asc'))

  return onSnapshot(q, snap => {
    const lista = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }))
    callback(lista)
  })
}

/* ============================================================
   🔵 OBTENER EVENTO POR ID
============================================================ */
export async function obtenerEventoPorId(id) {
  try {
    const ref = doc(db, 'eventos', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return { id, ...snap.data() }
  } catch (err) {
    console.error('❌ Error al obtener evento:', err)
    return null
  }
}
