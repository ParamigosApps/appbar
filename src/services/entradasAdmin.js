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

      const cantidad = Number(data.cantidad) || 1

      // ✅ PRECIO CANÓNICO (ORDEN CORRECTO)
      const precioUnitario =
        Number(data.lote?.precio) ||
        Number(data.precioUnitario) ||
        Number(data.precio) ||
        0

      return {
        id: d.id,
        ...data,

        cantidad,
        precioUnitario,
        precio: precioUnitario, // 🔁 alias para UI legacy
        monto: precioUnitario * cantidad,

        // 🔥 LOTE GARANTIZADO
        lote: data.lote ?? null,
        loteNombre: data.lote?.nombre || data.loteNombre || 'Entrada general',

        pagado: data.pagado ?? false,
      }
    })

    arr.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''))

    setLista(arr)
  })
}

// --------------------------------------------------------------
// ✅ APROBAR ENTRADA PENDIENTE
//   - Crea UNA entrada en "entradas" por cada unidad (cantidad)
//   - Elimina la solicitud pendiente
//   - Crea notificación en "notificaciones"
// --------------------------------------------------------------
// --------------------------------------------------------------
// ✅ APROBAR ENTRADA PENDIENTE (VERSIÓN CORREGIDA 2025)
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
      precio = 0,

      fecha, // legacy (string)
      fechaEvento, // nuevo (Timestamp o string)
      lugar,
      horario,
      horaInicio,
      horaFin,

      lote = null, // 🟢 OBJETO LOTE REAL
      loteIndice = null,
      loteNombre = null,

      pagado,
    } = entrada

    if (!eventoId || !usuarioId) {
      throw new Error('Faltan datos clave (eventoId o usuarioId)')
    }

    const cant = Number(cantidad) || 1
    const precioNum = Number(precio) || 0

    // ----------------------------------------------------------
    // 1️⃣ Crear entradas reales (1 doc por entrada)
    // ----------------------------------------------------------
    for (let i = 0; i < cant; i++) {
      await addDoc(collection(db, 'entradas'), {
        eventoId,
        usuarioId,
        usuarioNombre: usuarioNombre || 'Usuario',

        nombreEvento: eventoNombre || 'Evento',

        // 🧠 FECHAS (modelo nuevo + compatibilidad)
        fechaEvento: fechaEvento || fecha || null,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,

        lugar: lugar || '',
        horario: horario || '',

        // 💰
        precioUnitario: precioNum,

        // 🟢 LOTE REAL (CLAVE DEL FIX)
        lote:
          lote && typeof lote === 'object'
            ? lote
            : loteNombre
            ? { nombre: loteNombre }
            : null,

        // legacy (no rompen nada)
        loteIndice,
        loteNombre,

        estado: 'aprobada',
        metodo: 'transferencia',

        pagado: pagado ?? true,
        usado: false,

        creadoEn: serverTimestamp(),
      })
    }

    // ----------------------------------------------------------
    // 2️⃣ Eliminar pendiente
    // ----------------------------------------------------------
    await deleteDoc(doc(db, 'entradasPendientes', id))

    // ----------------------------------------------------------
    // 3️⃣ Notificación
    // ----------------------------------------------------------
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
