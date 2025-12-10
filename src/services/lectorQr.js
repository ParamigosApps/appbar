// --------------------------------------------------------------
// src/services/lectorQr.js — MOTOR DE VALIDACIÓN QR 2025 (FINAL)
// --------------------------------------------------------------
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

// --------------------------------------------------------------
// DECODIFICAR TEXTO DEL QR → OBJETO SEGURO
// --------------------------------------------------------------
export function decodificarQr(rawText) {
  if (!rawText) return { raw: '', error: 'QR vacío' }

  let payload = null

  // Intentar JSON
  try {
    payload = JSON.parse(rawText)
  } catch (_) {}

  // Formato prefijo: E|xxxxx  o  C|xxxxx
  if (!payload && rawText.includes('|')) {
    const [prefix, id] = rawText.split('|')
    payload = {
      tipo:
        prefix === 'E' ? 'entrada' : prefix === 'C' ? 'compra' : 'desconocido',
      id,
    }
  }

  // Fallback → texto simple = ID genérico
  if (!payload) {
    payload = { id: rawText }
  }

  return { raw: rawText, payload }
}

// --------------------------------------------------------------
// ANALIZAR PAYLOAD Y NORMALIZARLO (compatible con QR nuevos y viejos)
// --------------------------------------------------------------
export function analizarPayload(info) {
  if (!info || !info.payload) {
    return { tipo: 'desconocido', error: 'Payload vacío' }
  }

  const base = info.payload

  let tipo =
    base.tipo ||
    base.t ||
    base.kind ||
    (base.ticketId || base.entradaId ? 'entrada' : null) ||
    (base.compraId || base.pedidoId ? 'compra' : null)

  if (!tipo) tipo = 'desconocido'

  return {
    ...base,
    tipo,
    entradaId:
      base.ticketId || base.entradaId || (tipo === 'entrada' ? base.id : null),

    compraId:
      base.compraId || base.pedidoId || (tipo === 'compra' ? base.id : null),

    esEntrada: tipo === 'entrada',
    esCompra: tipo === 'compra',
  }
}

// --------------------------------------------------------------
// COLOR SEGÚN LOTE / GÉNERO / VIP
// --------------------------------------------------------------
function colorPorLote(data) {
  const nombre = (data.loteNombre || '').toLowerCase()
  const genero = (data.genero || data.loteGenero || '').toLowerCase()

  // Mujeres
  if (
    nombre.includes('mujer') ||
    nombre.includes('chica') ||
    genero.includes('mujer') ||
    genero.includes('chica')
  ) {
    return 'pink'
  }

  // VIP
  if (nombre.includes('vip')) return 'purple'

  return 'green'
}

// --------------------------------------------------------------
// VALIDAR ENTRADA
// --------------------------------------------------------------
export async function validarTicket(payload) {
  const { entradaId } = payload

  if (!entradaId) {
    return {
      ok: false,
      tipo: 'entrada',
      estado: 'rechazada',
      color: 'red',
      titulo: 'QR inválido',
      mensaje: 'El QR no contiene un ID de entrada válido.',
    }
  }

  const ref = doc(db, 'entradas', entradaId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    return {
      ok: false,
      tipo: 'entrada',
      estado: 'rechazada',
      color: 'red',
      titulo: 'Entrada inexistente',
      mensaje: 'No se encontró esta entrada en la base de datos.',
    }
  }

  const data = snap.data()

  // Pendiente / no pagado
  if (data.pagado === false || data.estado === 'pendiente') {
    return {
      ok: false,
      tipo: 'entrada',
      estado: 'pendiente',
      color: 'yellow',
      titulo: 'Pago pendiente',
      mensaje: 'La entrada no está confirmada. Verificá el pago.',
      data: { id: entradaId, ...data },
    }
  }

  // Ya utilizada
  if (data.usado) {
    return {
      ok: false,
      tipo: 'entrada',
      estado: 'usada',
      color: 'red',
      titulo: 'Entrada ya usada',
      mensaje: 'Esta entrada ya fue utilizada anteriormente.',
      data: { id: entradaId, ...data },
    }
  }

  const color = colorPorLote(data)

  return {
    ok: true,
    tipo: 'entrada',
    estado: 'ok',
    color,
    titulo:
      color === 'pink'
        ? 'Entrada válida — Lote chicas'
        : color === 'purple'
        ? 'Entrada válida — VIP'
        : 'Entrada válida',
    mensaje: 'Todo correcto.',
    data: { id: entradaId, ...data },
  }
}

// --------------------------------------------------------------
// VALIDAR COMPRA (CAJA / BARRA)
// --------------------------------------------------------------
export async function validarCompra(payload) {
  const { compraId } = payload

  if (!compraId) {
    return {
      ok: false,
      tipo: 'compra',
      estado: 'rechazada',
      color: 'red',
      titulo: 'QR inválido',
      mensaje: 'El QR no contiene un ID de compra válido.',
    }
  }

  const ref = doc(db, 'compras', compraId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    return {
      ok: false,
      tipo: 'compra',
      estado: 'rechazada',
      color: 'red',
      titulo: 'Compra inexistente',
      mensaje: 'No se encontró esta compra en el sistema.',
    }
  }

  const data = snap.data()

  if (data.pagado === false || data.estado === 'pendiente') {
    return {
      ok: false,
      tipo: 'compra',
      estado: 'pendiente',
      color: 'yellow',
      titulo: 'Pago pendiente',
      mensaje: 'La compra todavía no figura como pagada.',
      data: { id: compraId, ...data },
    }
  }

  if (data.retirada) {
    return {
      ok: false,
      tipo: 'compra',
      estado: 'retirada',
      color: 'red',
      titulo: 'Compra ya retirada',
      mensaje: 'Este pedido ya fue entregado anteriormente.',
      data: { id: compraId, ...data },
    }
  }

  return {
    ok: true,
    tipo: 'compra',
    estado: 'ok',
    color: 'blue',
    titulo: 'Compra válida',
    mensaje: 'Podés entregar la compra.',
    data: { id: compraId, ...data },
  }
}

// --------------------------------------------------------------
// MARCAR ENTRADA USADA
// --------------------------------------------------------------
export async function marcarEntradaUsada(entradaId) {
  if (!entradaId) return
  await updateDoc(doc(db, 'entradas', entradaId), {
    usado: true,
    usadoEn: serverTimestamp(),
  })
}

// --------------------------------------------------------------
// MARCAR COMPRA RETIRADA
// --------------------------------------------------------------
export async function marcarCompraRetirada(compraId) {
  if (!compraId) return
  await updateDoc(doc(db, 'compras', compraId), {
    retirada: true,
    retiradaEn: serverTimestamp(),
  })
}
