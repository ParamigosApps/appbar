// --------------------------------------------------------------
// ComprasAdmin.jsx — PANEL COMPRAS ADMIN (FINAL DEFINITIVO 2025)
// --------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'
import { useAuth } from '../../context/AuthContext'

// --------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------
function normalizarTexto(str) {
  return (
    str
      ?.toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') || ''
  )
}

function formatearFechaCompra(compra) {
  const base =
    compra.creadoEn?.toDate?.() ??
    compra.fecha?.toDate?.() ??
    (compra.fecha ? new Date(compra.fecha) : null)

  if (!base || isNaN(base.getTime())) return '-'

  return base.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  })
}

function colorEstado(estado) {
  switch (estado) {
    case 'pendiente':
      return 'warning'
    case 'pagado':
      return 'success'
    case 'retirado':
      return 'info'
    default:
      return 'secondary'
  }
}

// --------------------------------------------------------------
// DEVOLVER STOCK (ADMIN)
// --------------------------------------------------------------
async function devolverStockAdmin(items = []) {
  for (const item of items) {
    const prodId = item.productoId || item.id
    const cant = Number(item.enCarrito || item.cantidad || 0)
    if (!prodId || !cant) continue

    const ref = doc(db, 'productos', prodId)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const data = snap.data()
    await updateDoc(ref, { stock: (data.stock || 0) + cant })
  }
}

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
export default function ComprasAdmin() {
  const { empleado } = useAuth()
  const nivel = Number(empleado?.nivel || 0)

  // ⛔ CONTROL DE ACCESO
  if (nivel < 2) {
    return (
      <div className="alert alert-danger">
        ⛔ No tenés permiso para acceder al módulo de Compras.
      </div>
    )
  }

  // ------------------------------------------------------------
  // ESTADOS
  // ------------------------------------------------------------
  const [compras, setCompras] = useState([])
  const [eventos, setEventos] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [eventoSel, setEventoSel] = useState('todos')
  const [orden, setOrden] = useState('recientes')
  const [cargando, setCargando] = useState(true)

  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [fechaHasta, setFechaHasta] = useState(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d
  })

  // ------------------------------------------------------------
  // LISTENERS
  // ------------------------------------------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'compras'), snap => {
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'eventos'), snap => {
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // ------------------------------------------------------------
  // PROCESAMIENTO + MÉTRICAS
  // ------------------------------------------------------------
  const {
    comprasProcesadas,
    totalPedidos,
    totalRecaudado,
    totalPendiente,
    totalPagado,
    totalRetirado,
  } = useMemo(() => {
    let arr = [...compras]

    const b = normalizarTexto(busqueda)

    if (b) {
      arr = arr.filter(c =>
        [c.usuarioNombre, c.lugar, c.numeroPedido, c.estado, c.nombreEvento]
          .map(normalizarTexto)
          .some(v => v.includes(b))
      )
    }

    if (filtroEstado !== 'todos') {
      arr = arr.filter(c => c.estado === filtroEstado)
    }

    if (eventoSel !== 'todos') {
      arr = arr.filter(c => c.eventoId === eventoSel)
    }

    arr = arr.filter(c => {
      const f =
        c.creadoEn?.toDate?.() ??
        c.fecha?.toDate?.() ??
        (c.fecha ? new Date(c.fecha) : null)

      if (!f) return false
      return f >= fechaDesde && f <= fechaHasta
    })

    arr.sort((a, b) => {
      const fa = a.creadoEn?.toMillis?.() || 0
      const fb = b.creadoEn?.toMillis?.() || 0

      if (orden === 'montoDesc') return (b.total || 0) - (a.total || 0)
      if (orden === 'montoAsc') return (a.total || 0) - (b.total || 0)
      return fb - fa
    })

    const sum = fn => arr.filter(fn).reduce((acc, c) => acc + (c.total || 0), 0)

    return {
      comprasProcesadas: arr,
      totalPedidos: arr.length,
      totalRecaudado: sum(() => true),
      totalPendiente: sum(c => c.estado === 'pendiente'),
      totalPagado: sum(c => c.estado === 'pagado'),
      totalRetirado: sum(c => c.estado === 'retirado'),
    }
  }, [
    compras,
    busqueda,
    filtroEstado,
    eventoSel,
    orden,
    fechaDesde,
    fechaHasta,
  ])

  // ------------------------------------------------------------
  // ACCIONES ADMINISTRATIVAS
  // ------------------------------------------------------------
  async function marcarEstado(compra, estado) {
    await updateDoc(doc(db, 'compras', compra.id), {
      estado,
      pagado: estado !== 'pendiente',
      audit: {
        accion: estado,
        por: empleado.nombre,
        uid: empleado.uid,
        nivel,
        fecha: new Date(),
      },
    })
  }

  async function cancelarCompra(compra) {
    if (nivel < 3) return alert('No autorizado')
    if (!confirm(`Cancelar pedido #${compra.numeroPedido}?`)) return

    await devolverStockAdmin(compra.items || [])
    await deleteDoc(doc(db, 'compras', compra.id))
  }

  async function eliminarCompra(compra) {
    if (nivel !== 4) return alert('Solo el dueño puede eliminar')
    if (!confirm(`Eliminar DEFINITIVO #${compra.numeroPedido}?`)) return

    await deleteDoc(doc(db, 'compras', compra.id))
  }

  function exportarCSV() {
    if (nivel !== 4) return

    let csv = 'pedido,cliente,evento,estado,total,fecha\n'
    comprasProcesadas.forEach(c => {
      csv += `${c.numeroPedido},${c.usuarioNombre},${c.nombreEvento || '-'},${
        c.estado
      },${c.total},${formatearFechaCompra(c)}\n`
    })

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'compras.csv'
    a.click()
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  if (cargando) return <p>Cargando compras...</p>

  return (
    <div>
      <h4 className="fw-bold mb-3">🧾 Compras — Administración</h4>

      {/* MÉTRICAS */}
      <div className="row g-2 mb-3">
        <Metric title="Pedidos" value={totalPedidos} />
        <Metric title="Recaudado" value={totalRecaudado} />
        <Metric title="Pendiente" value={totalPendiente} />
        <Metric title="Pagado" value={totalPagado} />
        <Metric title="Retirado" value={totalRetirado} />
      </div>

      {/* CONTROLES */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Buscar..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <input
          type="date"
          className="form-control"
          style={{ maxWidth: 160 }}
          value={fechaDesde.toISOString().slice(0, 10)}
          onChange={e => {
            const d = new Date(e.target.value)
            d.setHours(0, 0, 0, 0)
            setFechaDesde(d)
          }}
        />

        <input
          type="date"
          className="form-control"
          style={{ maxWidth: 160 }}
          value={fechaHasta.toISOString().slice(0, 10)}
          onChange={e => {
            const d = new Date(e.target.value)
            d.setHours(23, 59, 59, 999)
            setFechaHasta(d)
          }}
        />

        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={eventoSel}
          onChange={e => setEventoSel(e.target.value)}
        >
          <option value="todos">Todos los eventos</option>
          {eventos.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.nombre}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 150 }}
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="retirado">Retirado</option>
        </select>

        {nivel === 4 && (
          <button
            className="btn btn-outline-success ms-auto"
            onClick={exportarCSV}
          >
            Exportar CSV
          </button>
        )}
      </div>

      {/* LISTADO */}
      {comprasProcesadas.map(c => (
        <div key={c.id} className="card p-3 mb-2">
          <div className="d-flex justify-content-between">
            <div>
              <strong>Pedido #{c.numeroPedido}</strong>{' '}
              <span className={`badge bg-${colorEstado(c.estado)}`}>
                {c.estado}
              </span>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {c.usuarioNombre} • {c.nombreEvento || '—'} •{' '}
                {formatearFechaCompra(c)}
              </div>
              {c.audit && (
                <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                  Última acción: <b>{c.audit.accion}</b> por {c.audit.por} (
                  nivel {c.audit.nivel})
                </div>
              )}
            </div>

            <div className="fw-bold">${c.total}</div>
          </div>

          <div className="d-flex gap-2 justify-content-end mt-2">
            {c.estado === 'pendiente' && (
              <button
                className="btn btn-sm btn-success"
                onClick={() => marcarEstado(c, 'pagado')}
              >
                Marcar pagado
              </button>
            )}
            {c.estado === 'pagado' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => marcarEstado(c, 'retirado')}
              >
                Marcar retirado
              </button>
            )}
            {nivel >= 3 && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => cancelarCompra(c)}
              >
                Cancelar
              </button>
            )}
            {nivel === 4 && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => eliminarCompra(c)}
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------
function Metric({ title, value }) {
  return (
    <div className="col-6 col-md-3">
      <div className="p-2 bg-light rounded text-center">
        <div style={{ fontSize: 12 }}>{title}</div>
        <div className="fw-bold">${value}</div>
      </div>
    </div>
  )
}
