// --------------------------------------------------------------
// src/services/eventosAdmin.js — VERSIÓN FINAL PRO 2025
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
    const url = await getDownloadURL(fileRef)
    return url
  } catch (err) {
    console.error('❌ Error al subir imagen:', err)
    return null
  }
}

/* ============================================================
   🔵 CREAR EVENTO (CON LOTES + CAMPOS NUEVOS)
============================================================ */
export async function crearEvento(datos, imagenArchivo = null) {
  try {
    let imagenUrl = ''

    if (imagenArchivo) {
      imagenUrl = await subirImagenEvento(imagenArchivo)
    }

    const evento = {
      nombre: datos.nombre,
      fecha: datos.fecha,
      horario: datos.horario,
      lugar: datos.lugar,
      precio: Number(datos.precio) || 0,
      descripcion: datos.descripcion || '',

      // Campos nuevos
      entradasMaximasEvento: Number(datos.entradasMaximasEvento) || 0,
      entradasPorUsuario: Number(datos.entradasPorUsuario) || 1,

      // Lotes
      lotes: Array.isArray(datos.lotes) ? datos.lotes : [],

      imagenEventoUrl: imagenUrl,

      estado: 'activo', // Nuevo: estado del evento
      creadoEn: serverTimestamp(),
    }

    console.log('📦 Evento creado:', evento)

    await addDoc(collection(db, 'eventos'), evento)
    return true
  } catch (err) {
    console.error('❌ Error al crear evento:', err)
    return false
  }
}

/* ============================================================
   🟣 EDITAR EVENTO
============================================================ */
export async function editarEvento(id, datos, imagenArchivo = null) {
  try {
    let imagenUrl = datos.imagenEventoUrl || ''

    if (imagenArchivo) {
      imagenUrl = await subirImagenEvento(imagenArchivo)
    }

    const nuevosDatos = {
      ...datos,
      imagenEventoUrl: imagenUrl,
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
   🔴 ELIMINAR EVENTO (solo se llama si UI validó que no tiene ventas)
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
   🟠 CANCELAR EVENTO (SIN BORRAR NADA)
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
   🔵 ESCUCHAR EVENTOS (ordenados por fecha)
============================================================ */
export function escucharEventos(callback) {
  const q = query(collection(db, 'eventos'), orderBy('fecha', 'asc'))
  return onSnapshot(q, snap => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(lista)
  })
}

/* ============================================================
   🔵 OBTENER EVENTO POR ID (para editar)
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
