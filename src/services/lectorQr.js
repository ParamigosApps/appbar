// --------------------------------------------------------------
// lectorQr.js — Servicio general del validador de QR
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
// 2) ANALIZAR TIPO
// --------------------------------------------------------------
export function analizarPayload(payload) {
  if (!payload || !payload.ticketId) return null

  // ► Si tiene numeroPedido = compra
  if (payload.numeroPedido) return 'compra'

  // ► Sino, es entrada
  return 'entrada'
}

// --------------------------------------------------------------
// 3) VALIDAR ENTRADA
// --------------------------------------------------------------
export async function validarTicket(ticketId) {
  try {
    const ref = doc(db, 'entradas', ticketId)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return {
        valido: false,
        mensaje: 'La entrada no existe.',
      }
    }

    const data = snap.data()

    if (data.usado) {
      return {
        valido: false,
        mensaje: `Entrada YA USADA — ${data.usuarioNombre || 'Desconocido'}`,
      }
    }

    await updateDoc(ref, {
      usado: true,
      usadoEn: serverTimestamp(),
    })

    return {
      valido: true,
      mensaje: `Entrada válida para: ${
        data.usuarioNombre || data.usuarioId || 'Usuario'
      }`,
      data,
    }
  } catch (err) {
    console.error(err)
    return {
      valido: false,
      mensaje: 'Error interno validando entrada.',
    }
  }
}

// --------------------------------------------------------------
// 4) VALIDAR COMPRA
// --------------------------------------------------------------
export async function validarCompra(ticketId) {
  try {
    const ref = doc(db, 'compras', ticketId)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return {
        valido: false,
        mensaje: 'La compra no existe.',
      }
    }

    const data = snap.data()

    if (data.usado) {
      return {
        valido: false,
        mensaje: `Compra YA ENTREGADA — Pedido #${
          data.numeroPedido || ticketId
        }`,
      }
    }

    await updateDoc(ref, {
      usado: true,
      usadoEn: serverTimestamp(),
    })

    return {
      valido: true,
      mensaje: `Compra válida — Pedido #${data.numeroPedido || ticketId}`,
      data,
    }
  } catch (err) {
    console.error(err)
    return {
      valido: false,
      mensaje: 'Error interno validando compra.',
    }
  }
}
