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
  serverTimestamp,
} from 'firebase/firestore'

// --------------------------------------------------------------
// Utils
// --------------------------------------------------------------
function fechaToMs(valor) {
  if (!valor) return 0

  if (typeof valor.toDate === 'function') {
    return valor.toDate().getTime()
  }

  if (typeof valor === 'string') {
    return new Date(valor).getTime() || 0
  }

  if (valor instanceof Date) {
    return valor.getTime()
  }

  return 0
}

// --------------------------------------------------------------
// 🔍 ESCUCHAR LISTA DE ENTRADAS PENDIENTES (ADMIN)
// --------------------------------------------------------------
export function escucharEntradasPendientes(setLista) {
  const q = query(collection(db, 'entradasPendientes'))

  return onSnapshot(q, snap => {
    const arr = snap.docs.map(d => {
      const data = d.data()
      const cantidad = Number(data.cantidad) || 1

      // 💰 Precio canónico
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
        precio: precioUnitario, // legacy UI
        monto: precioUnitario * cantidad,

        // 🟢 Lote garantizado
        lote: data.lote ?? null,
        loteNombre: data.lote?.nombre || data.loteNombre || 'Entrada general',

        loteIndice: Number.isFinite(data.loteIndice) ? data.loteIndice : null,

        pagado: data.pagado ?? false,
      }
    })

    arr.sort((a, b) => fechaToMs(b.creadoEn) - fechaToMs(a.creadoEn))

    setLista(arr)
  })
}

// --------------------------------------------------------------
// 🔴 ESCUCHAR CANTIDAD DE ENTRADAS PENDIENTES (BADGE)
// --------------------------------------------------------------
export function escucharCantidadEntradasPendientes(setCantidad) {
  const q = query(collection(db, 'entradasPendientes'))

  return onSnapshot(q, snap => {
    setCantidad(snap.size)
  })
}

// --------------------------------------------------------------
// ✅ APROBAR ENTRADA PENDIENTE (VERSIÓN FINAL 2025)
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

      fecha, // legacy
      fechaEvento,
      lugar,
      horario,
      horaInicio,
      horaFin,

      lote = null,
      loteIndice = null,
      loteNombre = null,

      pagado,
      operacionId: operacionIdEntrada, // 👈 CLAVE
    } = entrada

    if (!eventoId || !usuarioId) {
      throw new Error('Faltan datos clave')
    }

    const cant = Number(cantidad) || 1
    const precioNum = Number(precio) || 0

    // 🔥 RESPETAR OPERACIÓN DEL LOTE
    const operacionId = operacionIdEntrada || crypto.randomUUID()

    console.log('🧪 APROBANDO ENTRADA:', {
      id,
      loteIndice,
      loteNombre,
    })

    // ----------------------------------------------------------
    // 1️⃣ Crear entradas reales
    // ----------------------------------------------------------
    for (let i = 0; i < cant; i++) {
      await addDoc(collection(db, 'entradas'), {
        eventoId,
        usuarioId,
        usuarioNombre: usuarioNombre || 'Usuario',
        nombreEvento: eventoNombre || 'Evento',

        fechaEvento: fechaEvento || fecha || null,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,

        lugar: lugar || '',
        horario: horario || '',

        // 🔥 CAMPOS CLAVE PARA NOTIFICACIÓN
        aprobadaPor: 'admin',
        operacionId,

        estado: 'aprobada',
        metodo: 'transferencia',
        pagado: pagado ?? true,
        usado: false,

        precioUnitario: precioNum,

        lote:
          lote && typeof lote === 'object'
            ? lote
            : loteNombre
            ? { nombre: loteNombre }
            : null,

        loteIndice: Number.isFinite(loteIndice) ? loteIndice : null,
        loteNombre,

        // timestamps
        creadoEn: serverTimestamp(),
        aprobadaEn: serverTimestamp(),
      })
    }

    // ----------------------------------------------------------
    // 2️⃣ Eliminar pendiente
    // ----------------------------------------------------------
    await deleteDoc(doc(db, 'entradasPendientes', id))

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
// 💰 MARCAR COMO PAGADA / NO PAGADA
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
