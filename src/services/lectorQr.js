// --------------------------------------------------------------
// src/services/lectorQr.js — MOTOR DE VALIDACIÓN QR 2025 (FINAL PRO)
// --------------------------------------------------------------
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

/* ============================================================
   VALIDAR HORARIO FREE (EVENTO + LOTE)
   ============================================================ */
function validarHorarioFree(lote, evento) {
  if (!lote?.desdeHora || !lote?.hastaHora) return { ok: true }
  if (!evento?.fechaInicio) return { ok: true }

  const base = evento.fechaInicio.toDate()

  const fechaStr = `${base.getFullYear()}-${String(
    base.getMonth() + 1
  ).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`

  const { start, end } = intervaloEvento(
    fechaStr,
    lote.desdeHora,
    lote.hastaHora
  )

  const now = new Date()

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
   DECODIFICAR QR
   ============================================================ */
export function decodificarQr(rawText) {
  console.log('📥 QR RAW TEXT:', rawText)

  if (!rawText) return { raw: '', error: 'QR vacío' }

  let payload = null

  try {
    payload = JSON.parse(rawText)

    // 🔑 FIX: doble JSON string
    if (typeof payload === 'string') {
      payload = JSON.parse(payload)
    }
  } catch (err) {
    console.warn('⚠️ No se pudo parsear JSON, usando fallback', err)
  }

  if (!payload && rawText.includes('|')) {
    const [prefix, id] = rawText.split('|')
    payload = {
      id,
      tipo:
        prefix === 'E' ? 'entrada' : prefix === 'C' ? 'compra' : 'desconocido',
    }
  }

  if (!payload) payload = { id: rawText }

  console.log('📦 Payload decodificado FINAL:', payload)

  return { raw: rawText, payload }
}

/* ============================================================
   ANALIZAR PAYLOAD
   ============================================================ */
export function analizarPayload(info) {
  console.log('🟡 analizarPayload RAW:', info)

  // ❌ QR sin payload
  if (!info?.payload) {
    return {
      tipo: 'desconocido',
      id: null,
      entradaId: null,
      compraId: null,
      esEntrada: false,
      esCompra: false,
    }
  }

  const base = info.payload

  // 🔑 ID REAL (siempre uno solo)
  const id = base.id || base.entradaId || base.compraId || base.ticketId || null

  // 🔖 Tipo declarado (si viene)
  const tipo = base.tipo || 'desconocido'

  const esEntrada = tipo === 'entrada'
  const esCompra = tipo === 'compra'

  const result = {
    ...base,

    // Normalizados
    id,
    tipo,

    entradaId: esEntrada ? id : null,
    compraId: esCompra ? id : null,

    esEntrada,
    esCompra,
  }

  console.log('✅ Payload procesado FINAL:', result)

  return result
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
   VALIDAR HORARIO DE EVENTO
   ============================================================ */
function validarHorarioEvento(evento) {
  if (!evento.fechaInicio || !evento.fechaFin) return { ok: true }

  const ahora = new Date()
  const inicio = evento.fechaInicio.toDate()
  const fin = evento.fechaFin.toDate()

  if (ahora < inicio)
    return {
      ok: false,
      motivo: `El evento inicia a las <b>${evento.horaInicio}</b> hs.`,
    }

  if (ahora > fin)
    return {
      ok: false,
      motivo: `El evento finalizó a las <b>${evento.horaFin}</b> hs.`,
    }

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

  if (eventoForzado && data.eventoId !== eventoForzado) {
    return rechazoCompra(
      'Pedido de otro evento',
      'Este pedido no corresponde al evento seleccionado.'
    )
  }

  // Evento seleccionado o evento real de la entrada
  const eventoIdEntrada = data.eventoId
  const evento = await obtenerEvento(eventoIdEntrada)

  if (!evento)
    return rechazoEntrada('Evento no encontrado', 'Este evento ya no existe.')

  const fechaLarga = evento.fechaInicio
    ? evento.fechaInicio.toDate().toLocaleDateString('es-AR')
    : ''

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
    return rechazoEntrada(
      `Entrada para ${data.nombreEvento} ya usada`,
      `Validada hace ${tiempo}.`
    )
  }
  // FREE — validar horario del lote
  if (data.precio === 0) {
    const lote = evento.lotes?.[data.loteIndice]

    if (lote) {
      const val = validarHorarioFree(lote, evento)

      if (!val.ok) {
        return rechazoEntrada('Free fuera de horario', val.motivo)
      }
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
   VALIDAR COMPRA — VERSIÓN FINAL CORREGIDA
   ============================================================ */
export async function validarCompra({ compraId, eventoForzado = null }) {
  if (!compraId) {
    return rechazoCompra('QR inválido', 'No se pudo identificar la compra.')
  }

  const ref = doc(db, 'compras', compraId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    return rechazoCompra(
      'Compra inexistente',
      'La compra no existe o fue eliminada.'
    )
  }

  const data = snap.data()

  // ⛔ Ya retirada
  if (data.retirada) {
    const fecha = data.retiradaEn?.toDate
      ? data.retiradaEn.toDate().toLocaleString('es-AR')
      : 'Fecha desconocida'

    const por = data.retiradaPor?.nombre || 'Caja'
    const lugar = data.lugar || 'No especificado'

    return rechazoCompra(
      'Ticket ya utilizado',
      `
      <div style="
        background:#dc2626;
        color:#ffffff;
        padding:14px;
        border-radius:8px;
        text-align:center;
        font-weight:700;
        font-size:15px;
        margin-bottom:10px;
        border:2px solid #b91c1c;
      ">
        🎫 ESTE TICKET YA FUE UTILIZADO
      </div>

      <div style="
        font-size:14px;
        line-height:1.6;
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-radius:6px;
        padding:10px;
        font-weight:600;
      ">
        <div>🧾 Pedido: <b>#${data.numeroPedido}</b></div>
        <div>📅 Fecha: <b>${fecha}</b></div>
        <div>👤 Empleado: <b>${por}</b></div>
        <div>📍 Lugar: <b>${lugar}</b></div>
      </div>
      `
    )
  }

  // ⚠️ Pedido pendiente (NO pagado)
  if (!data.pagado) {
    return {
      ok: true,
      tipo: 'compra',
      color: 'orange',
      titulo: 'Pedido pendiente de pago',
      mensaje: 'Cobrar antes de marcar el pedido como abonado.',
      data: {
        id: snap.id,
        ...data, // ⬅️ expiraEn VIENE ACÁ
      },
      nombreEvento: data.eventoNombre || data.nombreEvento || null,
      fechaEvento: data.fechaEvento || data.eventoFecha || null,
    }
  }

  // ✅ Pagado y no retirado
  return {
    ok: true,
    tipo: 'compra',
    color: 'green',
    titulo: 'Compra válida',
    mensaje: 'Pedido abonado. Listo para entregar.',
    data: {
      id: snap.id,
      ...data, // ⬅️ expiraEn TAMBIÉN VIENE ACÁ
    },
    nombreEvento: data.eventoNombre || data.nombreEvento || null,
    fechaEvento: data.fechaEvento || data.eventoFecha || data.fecha || null,
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
  if (e.exists()) {
    return {
      tipo: 'entrada',
      entradaId: id,
      esEntrada: true,
      esCompra: false,
    }
  }

  const c = await getDoc(doc(db, 'compras', id))
  if (c.exists()) {
    return {
      tipo: 'compra',
      compraId: id,
      esEntrada: false,
      esCompra: true,
    }
  }

  return {
    tipo: 'desconocido',
    esEntrada: false,
    esCompra: false,
  }
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
