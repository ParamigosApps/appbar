// --------------------------------------------------------------
// src/services/lectorQr.js — MOTOR DE VALIDACIÓN QR 2025 (FINAL PRO)
// --------------------------------------------------------------
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

/* ============================================================
   FECHA → dd/mm/aaaa
   ============================================================ */
function formatearFechaDMY(fechaStr) {
  const [a, m, d] = fechaStr.split('-') // yyyy-mm-dd
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
   ANALIZAR PAYLOAD / NORMALIZAR
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
   INTERVALO DE TIEMPO (maneja medianoche)
   ============================================================ */
function buildDate(fechaString, horaString) {
  const [h, m] = horaString.split(':').map(n => parseInt(n))
  return new Date(
    `${fechaString}T${String(h).padStart(2, '0')}:${String(m).padStart(
      2,
      '0'
    )}:00`
  )
}

function intervaloEvento(fecha, desde, hasta) {
  const start = buildDate(fecha, desde)
  let end = buildDate(fecha, hasta)

  if (end <= start) end.setDate(end.getDate() + 1) // cruza medianoche
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
   VALIDAR HORARIO EVENTO  
   (esta función YA contempla medianoche correctamente)
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
   COLOR DEL LOTE
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
   VALIDAR ENTRADA (PRO MAX CORREGIDO)
   ============================================================ */
export async function validarTicket(payload) {
  const { entradaId } = payload

  if (!entradaId)
    return rechazoEntrada(
      'QR inválido',
      'El QR no contiene un ID de entrada válido.'
    )

  const snap = await getDoc(doc(db, 'entradas', entradaId))
  if (!snap.exists())
    return rechazoEntrada(
      'Entrada inexistente',
      'No se encontró en el sistema.'
    )

  const data = snap.data()

  // ======= EVENTO =======
  const evento = await obtenerEvento(data.eventoId)
  if (!evento)
    return rechazoEntrada('Evento no encontrado', 'Este evento ya no existe.')

  const fechaLarga = formatearFechaDMY(evento.fecha)

  // ============================================================
  // 1. VALIDACIÓN: ACTUALIZADA PARA EVENTOS QUE CRUZAN MEDIANOCHE
  // ============================================================

  const validEv = validarHorarioEvento(evento)

  // ⬅ Si el evento está ACTIVO ahora → OK directo
  if (validEv.ok) {
    // seguimos validando entrada normalmente más abajo
  } else {
    // ⬅ Si todavía NO empezó
    if (validEv.motivo.includes('inicia')) {
      const hoyISO = new Date().toISOString().slice(0, 10)
      const mañanaISO = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10)

      if (mañanaISO === evento.fecha) {
        return rechazoEntrada(
          '¡El evento es mañana!',
          `Esta entrada corresponde al evento <b>"${
            evento.nombre
          }"</b> del día <b>${fechaLarga}</b> a partir de las <b>${
            validEv.motivo.match(/\d{2}:\d{2}/)?.[0] || ''
          }</b> hs.`
        )
      }

      // evento es HOY pero todavía no empezó
      if (hoyISO === evento.fecha)
        return rechazoEntrada(
          'Este evento comienza más tarde..',
          validEv.motivo
        )

      // evento NO es hoy NI mañana → no corresponde
      return rechazoEntrada(
        'Fecha incorrecta',
        `Esta entrada corresponde al evento <b>"${evento.nombre}"</b> del día <b>${fechaLarga}</b>.`
      )
    }

    // ⬅ Si ya terminó → rechazo definitivo
    if (validEv.motivo.includes('finalizó'))
      return rechazoEntrada('Fuera de horario', validEv.motivo)
  }

  // ============================================================
  // 2. YA USADA
  // ============================================================
  if (data.usado) {
    const tiempo = tiempoTranscurrido(data.usadoEn)
    return rechazoEntrada('Entrada ya usada', `Validada hace ${tiempo}.`)
  }

  // ============================================================
  // 3. VALIDACIÓN FREE
  // ============================================================
  if (data.precio === 0) {
    const lote = evento.lotes?.[data.loteIndice]
    if (lote) {
      const freeVal = validarHorarioFree(lote, evento.fecha)
      if (!freeVal.ok)
        return rechazoEntrada('Free fuera de horario', freeVal.motivo)
    }
  }

  // ============================================================
  // 4. RESULTADO OK
  // ============================================================
  const color = colorPorLote(data)
  const categoria =
    color === 'pink' ? 'Lote Mujeres' : color === 'purple' ? 'VIP' : 'General'

  return {
    ok: true,
    tipo: 'entrada',
    estado: 'ok',
    color,
    titulo: `Entrada válida — ${categoria}`,
    mensaje: `Evento: <b>${evento.nombre}</b> · Lote: <b>${data.loteNombre}</b> · Titular: <b>${data.usuarioNombre}</b>`,
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
    return rechazoCompra('Compra inexistente', 'No se encontró en el sistema.')

  const data = snap.data()

  if (data.retirada) {
    const tiempo = tiempoTranscurrido(data.retiradaEn)
    return rechazoCompra('Ya retirada', `Pedido entregado hace ${tiempo}.`)
  }

  return {
    ok: true,
    tipo: 'compra',
    estado: 'ok',
    color: 'blue',
    titulo: 'Compra válida',
    mensaje: `Pedido listo para entregar.`,
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
    estado: 'rechazada',
    color: 'red',
    titulo,
    mensaje: msg,
  }
}

function rechazoCompra(titulo, msg) {
  return {
    ok: false,
    tipo: 'compra',
    estado: 'rechazada',
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
