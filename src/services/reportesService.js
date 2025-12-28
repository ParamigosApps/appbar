// --------------------------------------------------------------
// reportesService.js — REPORTES & CIERRES (CORE DE NEGOCIO)
// --------------------------------------------------------------
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../Firebase'

// --------------------------------------------------------------
// HELPERS FECHA
// --------------------------------------------------------------
function inicioDia(fecha) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

function finDia(fecha) {
  const d = new Date(fecha)
  d.setHours(23, 59, 59, 999)
  return d
}

function normalizarFechaISO(fecha) {
  return fecha instanceof Date ? fecha.toISOString().slice(0, 10) : fecha
}

// --------------------------------------------------------------
// MÉTRICAS GENERALES
// --------------------------------------------------------------
export function calcularMetricas(compras = []) {
  const sum = fn =>
    compras.filter(fn).reduce((acc, c) => acc + (c.total || 0), 0)

  return {
    pedidos: compras.length,
    total: sum(() => true),
    pendiente: sum(c => c.estado === 'pendiente'),
    pagado: sum(c => c.estado === 'pagado'),
    retirado: sum(c => c.estado === 'retirado'),
  }
}

// --------------------------------------------------------------
// OBTENER COMPRAS POR RANGO
// --------------------------------------------------------------
export async function obtenerComprasPorRango({
  fechaDesde,
  fechaHasta,
  eventoId = null,
}) {
  const desde = inicioDia(fechaDesde)
  const hasta = finDia(fechaHasta)

  let q = query(
    collection(db, 'compras'),
    where('creadoEn', '>=', desde),
    where('creadoEn', '<=', hasta)
  )

  if (eventoId) {
    q = query(
      collection(db, 'compras'),
      where('eventoId', '==', eventoId),
      where('creadoEn', '>=', desde),
      where('creadoEn', '<=', hasta)
    )
  }

  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// --------------------------------------------------------------
// AGRUPAR COMPRAS POR EVENTO
// --------------------------------------------------------------
export function agruparComprasPorEvento(compras = []) {
  const map = {}

  compras.forEach(c => {
    const key = c.eventoId || 'sin-evento'

    if (!map[key]) {
      map[key] = {
        eventoId: c.eventoId,
        nombreEvento: c.nombreEvento || 'Sin evento',
        fechaEvento: c.fechaEvento || null,
        compras: [],
      }
    }

    map[key].compras.push(c)
  })

  return Object.values(map)
}

// --------------------------------------------------------------
// CIERRE DE CAJA DIARIA
// --------------------------------------------------------------
export async function generarCierreCaja({ fecha, compras, empleado }) {
  const fechaISO = normalizarFechaISO(fecha)

  const ref = doc(db, 'cierres_caja', fechaISO)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    throw new Error('La caja de este día ya fue cerrada')
  }

  const metricas = calcularMetricas(compras)

  await setDoc(ref, {
    fecha: fechaISO,
    metricas,
    comprasSnapshot: compras.map(c => ({
      id: c.id,
      numeroPedido: c.numeroPedido,
      total: c.total,
      estado: c.estado,
      usuarioNombre: c.usuarioNombre,
      creadoEn: c.creadoEn || null,
    })),
    cerradoPor: {
      uid: empleado.uid,
      nombre: empleado.nombre,
      nivel: empleado.nivel,
    },
    cerradoEn: serverTimestamp(),
  })

  return metricas
}

// --------------------------------------------------------------
// CIERRE DE EVENTO
// --------------------------------------------------------------
export async function generarCierreEvento({
  eventoId,
  nombreEvento,
  fechaEvento,
  compras,
  empleado,
}) {
  if (!eventoId) throw new Error('Evento inválido')

  const ref = doc(db, 'cierres_evento', eventoId)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    throw new Error('El evento ya fue cerrado')
  }

  const metricas = calcularMetricas(compras)

  await setDoc(ref, {
    eventoId,
    nombreEvento,
    fechaEvento,
    metricas,
    comprasSnapshot: compras.map(c => ({
      id: c.id,
      numeroPedido: c.numeroPedido,
      total: c.total,
      estado: c.estado,
      usuarioNombre: c.usuarioNombre,
      creadoEn: c.creadoEn || null,
    })),
    cerradoPor: {
      uid: empleado.uid,
      nombre: empleado.nombre,
      nivel: empleado.nivel,
    },
    cerradoEn: serverTimestamp(),
  })

  return metricas
}

// --------------------------------------------------------------
// VALIDACIONES
// --------------------------------------------------------------
export async function existeCierreCaja(fecha) {
  const ref = doc(db, 'cierres_caja', normalizarFechaISO(fecha))
  const snap = await getDoc(ref)
  return snap.exists()
}

export async function existeCierreEvento(eventoId) {
  const ref = doc(db, 'cierres_evento', eventoId)
  const snap = await getDoc(ref)
  return snap.exists()
}
