// --------------------------------------------------------------
// src/services/entradasAdmin.js — ADMIN ENTRADAS (PENDIENTES)
// --------------------------------------------------------------
import { auth, db, functions } from '../Firebase.js'
import {
  addDoc,
  getDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  generarEntradaQr,
  subirQrGeneradoAFirebase,
} from '../services/generarQrService.js'

import { enviarMail } from '../services/mailService.js'
import { mailEntradasAprobadas } from '../services/mailTemplates.js'

const descontarCuposAdmin = httpsCallable(functions, 'descontarCuposAdmin')

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
  if (!auth.currentUser) {
    setLista([])
    return () => {}
  }

  const q = query(collection(db, 'entradasPendientes'))

  return onSnapshot(
    q,
    snap => {
      const arr = snap.docs.map(d => {
        const data = d.data()
        const cantidad = Number(data.cantidad) || 1

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
          precio: precioUnitario,
          monto: precioUnitario * cantidad,
          lote: data.lote ?? null,
          loteNombre: data.lote?.nombre || data.loteNombre || 'Entrada general',
          loteIndice: Number.isFinite(data.loteIndice) ? data.loteIndice : null,
          pagado: data.pagado ?? false,
        }
      })

      arr.sort((a, b) => fechaToMs(b.creadoEn) - fechaToMs(a.creadoEn))
      setLista(arr)
    },
    err => {
      if (err.code === 'permission-denied') {
        console.warn('🔒 Sin permiso para ver entradas pendientes')
        setLista([])
      } else {
        console.error(err)
      }
    }
  )
}

// --------------------------------------------------------------
// 🔴 ESCUCHAR CANTIDAD DE ENTRADAS PENDIENTES (BADGE)
// --------------------------------------------------------------
export function escucharCantidadEntradasPendientes(setCantidad) {
  // 🔒 SIN USUARIO → NO ESCUCHAR
  if (!auth.currentUser) {
    setCantidad(0)
    return () => {}
  }

  const q = query(collection(db, 'entradasPendientes'))

  return onSnapshot(
    q,
    snap => {
      setCantidad(snap.size)
    },
    err => {
      // 🔇 Cortar ruido infinito
      if (err.code === 'permission-denied') {
        console.warn('🔒 Sin permiso para entradasPendientes')
        setCantidad(0)
      } else {
        console.error('❌ Snapshot error:', err)
      }
    }
  )
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
      operacionId: operacionIdEntrada,
    } = entrada

    if (!eventoId || !usuarioId) {
      throw new Error('Faltan datos clave')
    }

    const cant = Number(cantidad) || 1
    const precioNum = Number(precio) || 0
    const pagadoFinal = true
    const operacionId = operacionIdEntrada || crypto.randomUUID()

    console.log('🧪 APROBANDO ENTRADA:', {
      id,
      loteIndice,
      loteNombre,
    })

    // ----------------------------------------------------------
    // 🧾 ACUMULADOR PARA MAIL (APILADO POR LOTE)
    // ----------------------------------------------------------
    const resumenLotes = {}

    const nombreLoteFinal = loteNombre || lote?.nombre || 'Entrada general'

    if (!resumenLotes[nombreLoteFinal]) {
      resumenLotes[nombreLoteFinal] = {
        nombre: nombreLoteFinal,
        cantidad: 0,
        horarioIngreso: lote?.horarioIngreso || lote?.ingreso || null,
      }
    }

    const qrsGenerados = []

    // ----------------------------------------------------------
    // 🔻 DESCONTAR CUPOS (ADMIN MANUAL)
    // ----------------------------------------------------------
    if (Number.isFinite(loteIndice)) {
      try {
        await descontarCuposAdmin({
          eventoId,
          loteIndice,
          cantidad: cant,
          usuarioId,
          compraId: id,
        })
      } catch (err) {
        console.error('❌ Error descontando cupos:', err)
        throw new Error(
          err?.message || 'No hay cupos disponibles para este lote'
        )
      }
    }

    for (let i = 0; i < cant; i++) {
      // 1️⃣ Crear la entrada
      const docRef = await addDoc(collection(db, 'entradas'), {
        eventoId,
        usuarioId,
        usuarioNombre: usuarioNombre || 'Usuario',
        nombreEvento: eventoNombre || 'Evento',

        fechaEvento: fechaEvento || fecha || null,
        horaInicio: horaInicio || null,
        horaFin: horaFin || null,

        lugar: lugar || '',
        horario: horario || '',

        aprobadaPor: 'admin',
        operacionId,

        estado: 'aprobado',
        metodo: 'transferencia',
        pagado: pagadoFinal,
        usado: false,

        precioUnitario: precioNum,

        lote:
          lote && typeof lote === 'object' ? lote : { nombre: nombreLoteFinal },

        loteIndice: Number.isFinite(loteIndice) ? loteIndice : null,
        loteNombre: nombreLoteFinal,

        creadoEn: serverTimestamp(),
        aprobadaEn: serverTimestamp(),
      })

      // --------------------------------------------------------
      // 2️⃣ Generar QR (FRONTEND)
      // --------------------------------------------------------
      const qrDiv = await generarEntradaQr({
        ticketId: docRef.id,
      })

      // --------------------------------------------------------
      // 3️⃣ Subir QR a Firebase Storage
      // --------------------------------------------------------
      const qrUrl = await subirQrGeneradoAFirebase({
        qrDiv,
        path: `entradas/${eventoId}/${docRef.id}.png`,
      })

      // --------------------------------------------------------
      // 4️⃣ Acumular para el mail
      // --------------------------------------------------------
      qrsGenerados.push({
        id: docRef.id,
        url: qrUrl,
      })

      resumenLotes[nombreLoteFinal].cantidad++
    }

    // ----------------------------------------------------------
    // 2️⃣ Eliminar pendiente
    // ----------------------------------------------------------
    await deleteDoc(doc(db, 'entradasPendientes', id))

    // ----------------------------------------------------------
    // 3️⃣ Obtener email del usuario (si existe)
    // ----------------------------------------------------------
    let emailUsuario = null

    try {
      const refUser = doc(db, 'usuarios', usuarioId)
      const snapUser = await getDoc(refUser)

      if (snapUser.exists()) {
        emailUsuario = snapUser.data().email || null
      }
    } catch (err) {
      console.warn('⚠️ No se pudo obtener email del usuario:', err)
    }

    // ----------------------------------------------------------
    // 4️⃣ Enviar mail (NO BLOQUEANTE)
    // ----------------------------------------------------------
    if (emailUsuario) {
      enviarMail({
        to: emailUsuario,
        subject: '🎟️ Tus entradas fueron aprobadas',
        html: mailEntradasAprobadas({
          usuarioNombre,
          eventoNombre,
          fechaEvento,
          lugar,
          horarioEvento: `${horaInicio || ''}${horaFin ? ' a ' + horaFin : ''}`,
          resumenLotes: Object.values(resumenLotes),
          qrs: qrsGenerados, // array de URLs
          metodo: 'Transferencia',
        }),
      }).catch(err =>
        console.warn('⚠️ Error enviando mail de entradas aprobadas:', err)
      )
    }

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
