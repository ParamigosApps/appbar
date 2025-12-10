// --------------------------------------------------------------
// lectorQr.js — Servicio general del validador de QR (FINAL)
// --------------------------------------------------------------
import { db } from '../Firebase.js'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

// --------------------------------------------------------------
// 1) DECODIFICAR QR
// --------------------------------------------------------------
export function decodificarQr(decodedText) {
  try {
    if (!decodedText || typeof decodedText !== 'string') return null

    const txt = decodedText.trim()

    // JSON → convertir
    if (txt.startsWith('{')) {
      const obj = JSON.parse(txt)
      return {
        ticketId: obj.id || null,
        numeroPedido: obj.pedido || null,
        usuarioId: obj.u || null,
      }
    }

    // Formato minimalista "id|pedido|usuario"
    const partes = txt.split('|')
    return {
      ticketId: partes[0]?.trim() || null,
      numeroPedido: partes[1]?.trim() || null,
      usuarioId: partes[2]?.trim() || null,
    }
  } catch (err) {
    console.error('Error decodificando QR:', err)
    return null
  }
}

// --------------------------------------------------------------
// 2) ANALIZAR TIPO (Entrada vs Compra)
// --------------------------------------------------------------
export function analizarPayload(payload) {
  if (!payload || !payload.ticketId) return null

  return payload.numeroPedido ? 'compra' : 'entrada'
}

// --------------------------------------------------------------
// 3) DETECTAR TIPO DE ENTRADA (Hombre / Mujer / Cancelada)
// --------------------------------------------------------------
function obtenerGeneroEntrada(data) {
  if (!data?.loteNombre) return 'neutral'

  const nombre = data.loteNombre.toLowerCase()

  if (nombre.includes('mujer')) return 'mujer'
  if (nombre.includes('hombre')) return 'hombre'
  if (data.estado === 'cancelada') return 'cancelada'

  return 'neutral'
}

// --------------------------------------------------------------
// 4) VALIDAR ENTRADA
// --------------------------------------------------------------
export async function validarTicket(ticketId) {
  try {
    const ref = doc(db, 'entradas', ticketId)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return {
        tipo: 'entrada',
        valido: false,
        mensaje: 'La entrada no existe.',
      }
    }

    const data = snap.data()
    const genero = obtenerGeneroEntrada(data)

    if (data.estado === 'cancelada') {
      return {
        tipo: 'entrada',
        valido: false,
        color: 'rojo',
        genero,
        mensaje: 'Entrada cancelada',
        data,
      }
    }

    if (data.usado) {
      return {
        tipo: 'entrada',
        valido: false,
        color: 'rojo',
        genero,
        mensaje: `Entrada YA USADA — ${data.usuarioNombre || 'Desconocido'}`,
        data,
      }
    }

    // marcar como usada
    await updateDoc(ref, {
      usado: true,
      usadoEn: serverTimestamp(),
    })

    return {
      tipo: 'entrada',
      valido: true,
      color:
        genero === 'mujer' ? 'rosa' : genero === 'hombre' ? 'azul' : 'verde',
      genero,
      mensaje: `Entrada válida — ${data.usuarioNombre || ''}`,
      data,
    }
  } catch (err) {
    console.error(err)
    return {
      tipo: 'entrada',
      valido: false,
      mensaje: 'Error interno validando entrada.',
    }
  }
}

// --------------------------------------------------------------
// 5) VALIDAR COMPRA
// --------------------------------------------------------------
export async function validarCompra(ticketId) {
  try {
    const ref = doc(db, 'compras', ticketId)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return {
        tipo: 'compra',
        valido: false,
        mensaje: 'La compra no existe.',
      }
    }

    const data = snap.data()

    if (data.estado === 'rechazada') {
      return {
        tipo: 'compra',
        valido: false,
        color: 'rojo',
        mensaje: 'Compra rechazada',
        data,
      }
    }

    if (data.usado) {
      return {
        tipo: 'compra',
        valido: false,
        color: 'rojo',
        mensaje: `Compra YA ENTREGADA — Pedido #${data.numeroPedido}`,
        data,
      }
    }

    // marcar como entregada
    await updateDoc(ref, {
      usado: true,
      usadoEn: serverTimestamp(),
    })

    return {
      tipo: 'compra',
      valido: true,
      color: 'verde',
      mensaje: `Compra válida — Pedido #${data.numeroPedido}`,
      data,
    }
  } catch (err) {
    console.error(err)
    return {
      tipo: 'compra',
      valido: false,
      mensaje: 'Error interno validando compra.',
    }
  }
}
