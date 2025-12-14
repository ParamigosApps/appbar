// --------------------------------------------------------------
// src/services/lectorQr.js — MOTOR DE VALIDACIÓN QR 2025 (FINAL PRO)
// --------------------------------------------------------------
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

/* ============================================================
   FECHA → dd/mm/aaaa
   ============================================================ */
function formatearFechaDMY(fechaStr) {
  const [a, m, d] = fechaStr.split('-')
  return `${d}/${m}/${a}`
}

/* ============================================================
   DECODIFICAR QR
   ============================================================ */
export function decodificarQr(rawText) {
  if (!rawText) return { raw: '', error: 'QR vacío' }

  let payload = null

  try {
    payload = JSON.parse(rawText)
  } catch (_) {}

  if (!payload && rawText.includes('|')) {
    const [prefix, id] = rawText.split('|')
    payload = {
      id,
      tipo:
        prefix === 'E' ? 'entrada' : prefix === 'C' ? 'compra' : 'desconocido',
    }
  }

  if (!payload) payload = { id: rawText }
  return { raw: rawText, payload }
}

/* ============================================================
   ANALIZAR PAYLOAD
   ============================================================ */
export function analizarPayload(info) {
  if (!info || !info.payload)
    return { tipo: 'desconocido', esEntrada: false, esCompra: false }

  const base = info.payload
  let tipo = base.tipo

  if (!tipo) {
    if (base.ticketId || base.entradaId) tipo = 'entrada'
    else if (base.compraId || base.pedidoId) tipo = 'compra'
    else tipo = 'desconocido'
  }

  const entradaId =
    base.ticketId || base.entradaId || (tipo === 'entrada' ? base.id : null)
  const compraId =
    base.compraId || base.pedidoId || (tipo === 'compra' ? base.id : null)

  return {
    ...base,
    tipo,
    entradaId,
    compraId,
    esEntrada: Boolean(entradaId),
    esCompra: Boolean(compraId),
  }
}

/* ============================================================
   OBTENER EVENTO
   ============================================================ */
export async function obtenerEvento(eventoId) {
  const snap = await getDoc(doc(db, 'eventos', eventoId))
  if (!snap.exists()) return null
  return { id: eventoId, ...snap.data() }
}

/* ============================================================
   INTERVALO DE TIEMPO
   ============================================================ */
function buildLocalDate(fechaString, horaString) {
  const [a, m, d] = fechaString.split('-').map(n => Number(n))
  const [hh, mm] = horaString.split(':').map(n => Number(n))

  const date = new Date()
  date.setFullYear(a)
  date.setMonth(m - 1)
  date.setDate(d)
  date.setHours(hh)
  date.setMinutes(mm)
  date.setSeconds(0)
  date.setMilliseconds(0)

  return date
}

function intervaloEvento(fecha, desde, hasta) {
  const start = buildLocalDate(fecha, desde)
  const end = buildLocalDate(fecha, hasta)

  if (end <= start) end.setDate(end.getDate() + 1)

  return { start, end }
}

/* ============================================================
   VALIDAR HORARIO FREE
   ============================================================ */
function validarHorarioFree(lote, fechaEvento) {
  if (!lote.desdeHora || !lote.hastaHora) return { ok: true }

  const now = new Date()
  const { start, end } = intervaloEvento(
    fechaEvento,
    lote.desdeHora,
    lote.hastaHora
  )

  if (now < start)
    return {
      ok: false,
      motivo: `Horario FREE inicia a las <b>${lote.desdeHora}</b>`,
    }

  if (now > end)
    return {
      ok: false,
      motivo: `Horario FREE finalizó a las <b>${lote.hastaHora}</b>`,
    }

  return { ok: true }
}

/* ============================================================
   VALIDAR HORARIO DE EVENTO
   ============================================================ */
function validarHorarioEvento(evento) {
  const now = new Date()

  const match = evento.horario?.match(/(\d{2}:\d{2}).+?(\d{2}:\d{2})/)
  if (!match) return { ok: true }

  const desde = match[1]
  const hasta = match[2]

  const { start, end } = intervaloEvento(evento.fecha, desde, hasta)

  if (now < start)
    return { ok: false, motivo: `El evento inicia a las <b>${desde}</b> hs.` }

  if (now > end)
    return { ok: false, motivo: `El evento finalizó a las <b>${hasta}</b> hs.` }

  return { ok: true }
}

/* ============================================================
   COLOR DE LOTE
   ============================================================ */
function colorPorLote(data) {
  const nombre = (data.loteNombre || '').toLowerCase()
  const genero = (data.genero || '').toLowerCase()

  if (
    nombre.includes('mujer') ||
    genero.includes('mujer') ||
    genero.includes('f')
  )
    return 'pink'

  if (nombre.includes('vip')) return 'purple'

  return 'green'
}

/* ============================================================
   VALIDAR ENTRADA — VERSIÓN FINAL CON EVENTO FORZADO
   ============================================================ */
export async function validarTicket(payload, eventoForzado = null) {
  const { entradaId } = payload

  if (!entradaId)
    return rechazoEntrada('QR inválido', 'El QR no contiene un ID válido.')

  const snap = await getDoc(doc(db, 'entradas', entradaId))
  if (!snap.exists())
    return rechazoEntrada('Entrada inexistente', 'No figura en el sistema.')

  const data = snap.data()

  // Evento seleccionado o evento real de la entrada
  const eventoIdFinal = eventoForzado || data.eventoId
  const evento = await obtenerEvento(eventoIdFinal)

  if (!evento)
    return rechazoEntrada('Evento no encontrado', 'Este evento ya no existe.')

  const fechaLarga = formatearFechaDMY(evento.fecha)

  // VALIDAR HORARIO DEL EVENTO
  const validEv = validarHorarioEvento(evento)

  if (!validEv.ok) {
    if (validEv.motivo.includes('inicia'))
      return rechazoEntrada('Aún no habilitado', validEv.motivo)

    if (validEv.motivo.includes('finalizó'))
      return rechazoEntrada('Fuera de horario', validEv.motivo)

    return rechazoEntrada('Fecha incorrecta', `Evento: ${fechaLarga}`)
  }

  // YA USADA
  if (data.usado) {
    const tiempo = tiempoTranscurrido(data.usadoEn)
    return rechazoEntrada('Entrada ya usada', `Validada hace ${tiempo}.`)
  }

  // FREE
  if (data.precio === 0) {
    const lote = evento.lotes?.[data.loteIndice]
    if (lote) {
      const val = validarHorarioFree(lote, evento.fecha)
      if (!val.ok) return rechazoEntrada('Free fuera de horario', val.motivo)
    }
  }

  // OK
  const color = colorPorLote(data)
  const categoria =
    color === 'pink' ? 'Lote Mujeres' : color === 'purple' ? 'VIP' : 'General'

  return {
    ok: true,
    tipo: 'entrada',
    color,
    titulo: `Entrada válida — ${categoria}`,
    mensaje: `
  Evento: <b>${evento.nombre}</b><br>
  ${data.loteNombre ? `Lote: <b>${data.loteNombre}</b><br>` : ''}
  Titular: <b>${data.usuarioNombre}</b>
`,

    data: { id: entradaId, ...data },
  }
}

/* ============================================================
   VALIDAR COMPRA
   ============================================================ */
export async function validarCompra(payload) {
  const { compraId } = payload
  if (!compraId) return rechazoCompra('QR inválido', 'Sin ID de compra.')

  const snap = await getDoc(doc(db, 'compras', compraId))
  if (!snap.exists())
    return rechazoCompra('Compra inexistente', 'No se encontró.')

  const data = snap.data()

  // ⛔ NO bloqueamos por "retirada"
  // retirada = ticket entregado al cliente

  if (!data.pagado) {
    return {
      ok: true,
      tipo: 'compra',
      color: 'orange',
      titulo: 'Compra pendiente de pago',
      mensaje: 'El pedido aún no fue abonado.',
      data: { id: compraId, ...data },
    }
  }

  return {
    ok: true,
    tipo: 'compra',
    color: 'blue',
    titulo: 'Compra válida',
    mensaje: 'Pedido listo para entregar ticket.',
    data: { id: compraId, ...data },
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function rechazoEntrada(titulo, msg) {
  return {
    ok: false,
    tipo: 'entrada',
    color: 'red',
    titulo,
    mensaje: msg,
  }
}

function rechazoCompra(titulo, msg) {
  return {
    ok: false,
    tipo: 'compra',
    color: 'red',
    titulo,
    mensaje: msg,
  }
}

export async function marcarEntradaUsada(id) {
  await updateDoc(doc(db, 'entradas', id), {
    usado: true,
    usadoEn: serverTimestamp(),
  })
}

export async function marcarCompraRetirada(id) {
  await updateDoc(doc(db, 'compras', id), {
    retirada: true,
    retiradaEn: serverTimestamp(),
  })
}

export async function detectarTipoPorFirestore(id) {
  const e = await getDoc(doc(db, 'entradas', id))
  if (e.exists()) return { tipo: 'entrada', entradaId: id, esEntrada: true }

  const c = await getDoc(doc(db, 'compras', id))
  if (c.exists()) return { tipo: 'compra', compraId: id, esCompra: true }

  return { tipo: 'desconocido' }
}

function tiempoTranscurrido(timestamp) {
  if (!timestamp) return null
  const diff = Date.now() - timestamp.toMillis()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'unos segundos'
  if (min === 1) return '1 minuto'
  if (min < 60) return `${min} minutos`
  const h = Math.floor(min / 60)
  if (h === 1) return '1 hora'
  if (h < 24) return `${h} horas`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 día' : `${d} días`
}
