// --------------------------------------------------------------
// productosAdmin.js — CRUD PRODUCTOS + Storage
// --------------------------------------------------------------
import { db, storage } from '../Firebase.js'

import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
} from 'firebase/firestore'

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'

// --------------------------------------------------------------
// Subir imagen a Storage
// --------------------------------------------------------------
export async function subirImagenProducto(file, productId) {
  const path = `productos/${productId}/${Date.now()}_${file.name}`
  const refFile = storageRef(storage, path)
  const snapshot = await uploadBytes(refFile, file)
  const url = await getDownloadURL(snapshot.ref)
  return { url, path }
}

// --------------------------------------------------------------
// Crear producto
// datos: { nombre, descripcion, precio, categoria, stock, destacado }
// file: File | null
// --------------------------------------------------------------
export async function crearProducto(datos, file = null) {
  try {
    const baseData = {
      nombre: (datos.nombre || '').trim(),
      descripcion: (datos.descripcion || '').trim(),
      precio: Number(datos.precio) || 0,
      categoria: (datos.categoria || '').trim(),
      stock: Number(datos.stock) || 0,
      destacado: !!datos.destacado,
      imagen: '',
      imagenPath: '',
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, 'productos'), baseData)

    // Si hay imagen, la subimos y actualizamos el doc
    if (file) {
      const up = await subirImagenProducto(file, docRef.id)
      await updateDoc(doc(db, 'productos', docRef.id), {
        imagen: up.url,
        imagenPath: up.path,
        actualizadoEn: serverTimestamp(),
      })
    }

    return true
  } catch (err) {
    console.error('❌ Error al crear producto:', err)
    return false
  }
}

// --------------------------------------------------------------
// Actualizar producto
// id: id del doc
// datos: { nombre, descripcion, precio, categoria, stock, destacado }
// file: File | null (nueva imagen)
// imagenPathAnterior: string | null (para borrar la vieja)
// --------------------------------------------------------------
export async function actualizarProducto(
  id,
  datos,
  file = null,
  imagenPathAnterior = null
) {
  try {
    const refDoc = doc(db, 'productos', id)

    const baseData = {
      nombre: (datos.nombre || '').trim(),
      descripcion: (datos.descripcion || '').trim(),
      precio: Number(datos.precio) || 0,
      categoria: (datos.categoria || '').trim(),
      stock: Number(datos.stock) || 0,
      destacado: !!datos.destacado,
      actualizadoEn: serverTimestamp(),
    }

    // Si NO hay nueva imagen, solo actualizamos data
    if (!file) {
      await updateDoc(refDoc, baseData)
      return true
    }

    // Si HAY nueva imagen: subir, actualizar campos y borrar la vieja
    const up = await subirImagenProducto(file, id)

    await updateDoc(refDoc, {
      ...baseData,
      imagen: up.url,
      imagenPath: up.path,
    })

    if (imagenPathAnterior) {
      try {
        await deleteObject(storageRef(storage, imagenPathAnterior))
      } catch (err) {
        console.warn('⚠ No se pudo eliminar imagen anterior:', err)
      }
    }

    return true
  } catch (err) {
    console.error('❌ Error al actualizar producto:', err)
    return false
  }
}

// --------------------------------------------------------------
// Eliminar producto + imagen (si existe)
// --------------------------------------------------------------
export async function eliminarProducto(id, imagenPath = null) {
  try {
    await deleteDoc(doc(db, 'productos', id))

    if (imagenPath) {
      try {
        await deleteObject(storageRef(storage, imagenPath))
      } catch (err) {
        console.warn('⚠ No se pudo eliminar imagen de Storage:', err)
      }
    }

    return true
  } catch (err) {
    console.error('❌ Error al eliminar producto:', err)
    return false
  }
}

// --------------------------------------------------------------
// Escuchar productos (real-time)
// callback recibe: [{ id, ...data }]
// --------------------------------------------------------------
export function escucharProductos(callback) {
  const q = query(collection(db, 'productos'), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(lista)
  })
}

// (Opcional) obtener un producto puntual si lo necesitás
export async function obtenerProducto(id) {
  const snap = await getDoc(doc(db, 'productos', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}
