// --------------------------------------------------------------
// src/services/entradasAdmin.js — ADMIN ENTRADAS (PENDIENTES)
// --------------------------------------------------------------
import { db } from '../Firebase.js'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore'

// --------------------------------------------------------------
// 🔍 ESCUCHAR ENTRADAS PENDIENTES (tempo real para Admin)
// --------------------------------------------------------------
export function escucharEntradasPendientes(setLista) {
  const q = query(collection(db, 'entradasPendientes'))

  return onSnapshot(q, snap => {
    const arr = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        // normalizar campos
        cantidad: Number(data.cantidad || 1),
        precio: Number(data.precio || 0),
        monto:
          typeof data.monto === 'number'
            ? data.monto
            : Number(data.precio || 0) * Number(data.cantidad || 1),
        pagado: data.pagado ?? false,
      }
    })

    // Ordenar por fecha de creación (si existe)
    arr.sort((a, b) => {
      const fa = a.creadaEn || ''
      const fb = b.creadaEn || ''
      return fb.localeCompare(fa)
    })

    setLista(arr)
  })
}

// --------------------------------------------------------------
// ✅ APROBAR ENTRADA PENDIENTE
//   - Crea UNA entrada en "entradas" por cada unidad (cantidad)
//   - Elimina la solicitud pendiente
//   - Crea notificación en "notificaciones"
// --------------------------------------------------------------
export async function aprobarEntrada(entrada) {
  try {
    const {
      id,
      eventoId,
      usuarioId,
      usuarioNombre,
      eventoNombre,
      cantidad = 1,
      fecha,
      lugar,
      horario,
      precio,
      loteIndice = null,
      loteNombre = null,
      pagado,
    } = entrada

    if (!eventoId || !usuarioId) {
      throw new Error('Faltan datos clave (eventoId o usuarioId)')
    }

    const cant = Number(cantidad) || 1
    const precioNum = Number(precio) || 0

    // 1) Crear entradas reales (1 doc por persona)
    for (let i = 0; i < cant; i++) {
      await addDoc(collection(db, 'entradas'), {
        eventoId,
        usuarioId,
        usuarioNombre: usuarioNombre || 'Usuario',
        nombreEvento: eventoNombre || 'Evento',
        fecha,
        lugar,
        horario,
        precio: precioNum,
        cantidad: 1,
        creadoEn: new Date().toISOString(),
        estado: 'aprobada',
        loteIndice,
        loteNombre,
        pagado: pagado ?? true,
        usado: false,
      })
    }

    // 2) Eliminar pendiente
    await deleteDoc(doc(db, 'entradasPendientes', id))

    // 3) Notificación al usuario (mismo esquema que tu admin.js viejo)
    await addDoc(collection(db, 'notificaciones'), {
      usuarioId,
      nombreEvento: eventoNombre,
      cantidad: cant,
      tipo: 'entrada_aprobada',
      creadoEn: serverTimestamp(),
      visto: false,
    })

    return true
  } catch (err) {
    console.error('❌ Error aprobarEntrada:', err)
    return false
  }
}

// --------------------------------------------------------------
// ❌ RECHAZAR ENTRADA PENDIENTE
// --------------------------------------------------------------
export async function rechazarEntrada(id) {
  try {
    await deleteDoc(doc(db, 'entradasPendientes', id))
    return true
  } catch (err) {
    console.error('❌ Error rechazarEntrada:', err)
    return false
  }
}

// --------------------------------------------------------------
// 💰 MARCAR COMO PAGADA / NO PAGADA (pendiente)
// --------------------------------------------------------------
export async function marcarComoPagada(id, pagado) {
  try {
    await updateDoc(doc(db, 'entradasPendientes', id), {
      pagado: !!pagado,
    })
    return true
  } catch (err) {
    console.error('❌ Error marcarComoPagada:', err)
    return false
  }
}
