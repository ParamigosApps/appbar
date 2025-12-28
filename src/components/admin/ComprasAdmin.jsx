// --------------------------------------------------------------
// src/components/admin/ComprasAdmin.jsx — COMPRAS ADMIN 2025
// --------------------------------------------------------------
import { useEffect, useState, useMemo, Fragment } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../Firebase.js'

// --------------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------------
function normalizarTexto(str) {
  return (
    str
      ?.trim()
      ?.toLowerCase()
      ?.normalize('NFD')
      ?.replace(/[\u0300-\u036f]/g, '') || ''
  )
}

// Fecha legible a partir de Timestamp / Date / string
function formatearFecha(ts) {
  try {
    if (!ts) return '-'

    // Firestore Timestamp
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString('es-AR')
    }

    // ISO string o milisegundos
    return new Date(ts).toLocaleString('es-AR')
  } catch {
    return '-'
  }
}

function formatearFechaEvento(fecha) {
  try {
    if (!fecha) return null

    if (typeof fecha.toDate === 'function') {
      return fecha.toDate().toLocaleDateString('es-AR')
    }

    return new Date(fecha).toLocaleDateString('es-AR')
  } catch {
    return null
  }
}

// Inferir método de pago si no viene seteado
function obtenerMetodoPago(pedido) {
  const metodo = pedido.metodoPago
  if (metodo === 'mercadopago' || metodo === 'caja') return metodo

  // Inferencias suaves:
  if (pedido.pagado && pedido.lugar === 'Tienda') return 'mercadopago'
  if (pedido.pagado && pedido.lugar && pedido.lugar.startsWith('Barra')) {
    return 'caja'
  }

  // Fallback
  return 'caja'
}

// Config visual por lugar
const lugaresConfig = {
  Tienda: {
    color: '#0d6efd',
    label: 'Barra Tienda',
  },
  'Barra 1': {
    color: '#fd7e14',
    label: 'Barra 1',
  },
  'Barra 2': {
    color: '#198754',
    label: 'Barra 2',
  },
  'Barra 3': {
    color: '#6f42c1',
    label: 'Barra 3',
  },
  Otro: {
    color: '#6c757d',
    label: 'Otros / Sin lugar',
  },
}

// CSV por lugar
function exportarCSVCompras(lugar, compras) {
  const SEP = ';'
  let csv = `numeroPedido${SEP}usuario${SEP}metodoPago${SEP}estado${SEP}lugar${SEP}total${SEP}fecha${SEP}items\n`

  compras.forEach(p => {
    const fecha = formatearFecha(p.creadoEn || p.fecha)
    const metodo = obtenerMetodoPago(p)
    const itemsTexto = Array.isArray(p.items)
      ? p.items
          .map(it => `${it.nombre || '-'} x${it.enCarrito || it.cantidad || 0}`)
          .join(' | ')
      : '-'

    csv += `${p.numeroPedido || '-'}${SEP}${p.usuarioNombre || '-'}${SEP}${
      metodo || '-'
    }${SEP}${p.estado || '-'}${SEP}${p.lugar || '-'}${SEP}${
      p.total || 0
    }${SEP}${fecha}${SEP}"${itemsTexto}"\n`
  })

  const totalRecaudado = compras.reduce((acc, p) => acc + (p.total || 0), 0)
  const totalProductos = compras.reduce((acc, p) => {
    if (!Array.isArray(p.items)) return acc
    return (
      acc +
      p.items.reduce((a, it) => a + Number(it.enCarrito || it.cantidad || 0), 0)
    )
  }, 0)

  csv += `\nRESUMEN DEL LUGAR: ${lugar}\n`
  csv += `Total recaudado${SEP}${SEP}${SEP}${SEP}${SEP}${totalRecaudado}\n`
  csv += `Cantidad de pedidos${SEP}${SEP}${SEP}${SEP}${SEP}${compras.length}\n`
  csv += `Productos vendidos${SEP}${SEP}${SEP}${SEP}${SEP}${totalProductos}\n`

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `compras_${lugar.replace(/\s+/g, '_')}.csv`
  link.click()
}

// Badge de estado
function BadgeEstado({ estado }) {
  const est = (estado || '').toLowerCase()

  let bg = '#6c757d'
  let label = estado || '—'

  if (est === 'pendiente') {
    bg = '#ffc107'
    label = 'Pendiente'
  } else if (est === 'pagado') {
    bg = '#0d6efd'
    label = 'Pagado'
  } else if (est === 'retirado') {
    bg = '#198754'
    label = 'Retirado'
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: bg,
        color: '#fff',
      }}
    >
      {label}
    </span>
  )
}

// Chip de método de pago
function ChipMetodo({ metodo }) {
  const m = metodo === 'mercadopago' ? 'mercadopago' : 'caja'

  const estilos =
    m === 'mercadopago'
      ? { bg: '#0d6efd15', border: '#0d6efd40', color: '#0d6efd' }
      : { bg: '#19875415', border: '#19875440', color: '#198754' }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.75rem',
        border: `1px solid ${estilos.border}`,
        background: estilos.bg,
        color: estilos.color,
        fontWeight: 500,
      }}
    >
      {m === 'mercadopago' ? 'Mercado Pago' : 'Pago en caja'}
    </span>
  )
}

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
export default function ComprasAdmin() {
  const [compras, setCompras] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [filtroLugar, setFiltroLugar] = useState('todos')
  const [openLugar, setOpenLugar] = useState(null)

  // Listener tiempo real a TODAS las compras
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'compras'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCompras(lista)
    })

    return () => unsub()
  }, [])

  // --------------------------------------------------------------
  // PROCESAR DATOS
  // --------------------------------------------------------------
  const { resumenGlobal, porLugar, statsPorLugar } = useMemo(() => {
    let arr = [...compras]

    const b = normalizarTexto(busqueda)

    // Búsqueda por cliente, número de pedido o lugar
    if (b !== '') {
      arr = arr.filter(p => {
        const nombre = normalizarTexto(p.usuarioNombre)
        const lugar = normalizarTexto(p.lugar)
        const nro = String(p.numeroPedido || '').toLowerCase()
        return (
          nombre.includes(b) ||
          lugar.includes(b) ||
          nro.includes(b.toLowerCase())
        )
      })
    }

    // Filtro estado
    if (filtroEstado !== 'todos') {
      arr = arr.filter(p => (p.estado || '').toLowerCase() === filtroEstado)
    }

    // Filtro método
    if (filtroMetodo !== 'todos') {
      arr = arr.filter(p => obtenerMetodoPago(p) === filtroMetodo)
    }

    // Filtro lugar
    if (filtroLugar !== 'todos') {
      arr = arr.filter(p => (p.lugar || 'Otro') === filtroLugar)
    }

    // Orden: más recientes primero
    arr.sort((a, b) => {
      const fa =
        a.creadoEn?.toDate?.() ?? a.fecha?.toDate?.() ?? new Date(a.fecha || 0)
      const fb =
        b.creadoEn?.toDate?.() ?? b.fecha?.toDate?.() ?? new Date(b.fecha || 0)

      return fb - fa
    })

    // Resumen global
    const totalRecaudado = arr.reduce((acc, p) => acc + (p.total || 0), 0)
    const totalPedidos = arr.length
    const totalProductos = arr.reduce((acc, p) => {
      if (!Array.isArray(p.items)) return acc
      return (
        acc +
        p.items.reduce(
          (a, it) => a + Number(it.enCarrito || it.cantidad || 0),
          0
        )
      )
    }, 0)

    const resumenGlobal = {
      totalRecaudado,
      totalPedidos,
      totalProductos,
    }

    // Agrupar por lugar
    const porLugar = {}
    const statsPorLugar = {}

    arr.forEach(p => {
      const lugarKey = p.lugar || 'Otro'
      if (!porLugar[lugarKey]) porLugar[lugarKey] = []
      porLugar[lugarKey].push(p)

      if (!statsPorLugar[lugarKey]) {
        statsPorLugar[lugarKey] = {
          pedidos: 0,
          total: 0,
          productos: 0,
          mp: 0,
          caja: 0,
        }
      }

      const s = statsPorLugar[lugarKey]
      s.pedidos += 1
      s.total += p.total || 0

      if (Array.isArray(p.items)) {
        s.productos += p.items.reduce(
          (a, it) => a + Number(it.enCarrito || it.cantidad || 0),
          0
        )
      }

      const metodo = obtenerMetodoPago(p)
      if (metodo === 'mercadopago') s.mp += p.total || 0
      if (metodo === 'caja') s.caja += p.total || 0
    })

    return { resumenGlobal, porLugar, statsPorLugar }
  }, [compras, busqueda, filtroEstado, filtroMetodo, filtroLugar])

  const lugaresOrden = ['Tienda', 'Barra 1', 'Barra 2', 'Barra 3', 'Otro']

  // --------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------
  return (
    <div>
      <h4 className="fw-bold mb-3">Compras — Panel General</h4>

      {/* RESUMEN GLOBAL */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="p-3 rounded shadow-sm bg-white h-100">
            <div className="text-muted" style={{ fontSize: '.8rem' }}>
              Total recaudado
            </div>
            <div
              className="fw-bold"
              style={{ fontSize: '1.4rem', color: '#111' }}
            >
              ${resumenGlobal.totalRecaudado || 0}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-4">
          <div className="p-3 rounded shadow-sm bg-white h-100">
            <div className="text-muted" style={{ fontSize: '.8rem' }}>
              Pedidos totales
            </div>
            <div className="fw-bold" style={{ fontSize: '1.4rem' }}>
              {resumenGlobal.totalPedidos || 0}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-4">
          <div className="p-3 rounded shadow-sm bg-white h-100">
            <div className="text-muted" style={{ fontSize: '.8rem' }}>
              Productos vendidos
            </div>
            <div className="fw-bold" style={{ fontSize: '1.4rem' }}>
              {resumenGlobal.totalProductos || 0}
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Buscar por cliente, pedido o lugar…"
          style={{ maxWidth: 260 }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <select
          className="form-select"
          style={{ maxWidth: 150 }}
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Estado: Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="retirado">Retirado</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 170 }}
          value={filtroMetodo}
          onChange={e => setFiltroMetodo(e.target.value)}
        >
          <option value="todos">Método: Todos</option>
          <option value="mercadopago">Mercado Pago</option>
          <option value="caja">Pago en caja</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 150 }}
          value={filtroLugar}
          onChange={e => setFiltroLugar(e.target.value)}
        >
          <option value="todos">Lugar: Todos</option>
          <option value="Tienda">Tienda</option>
          <option value="Barra 1">Barra 1</option>
          <option value="Barra 2">Barra 2</option>
          <option value="Barra 3">Barra 3</option>
          <option value="Otro">Otros / Sin lugar</option>
        </select>
      </div>

      {/* LISTA POR LUGAR */}
      {lugaresOrden.map(lugarKey => {
        const comprasLugar = porLugar[lugarKey]
        if (!comprasLugar || comprasLugar.length === 0) return null

        const cfg = lugaresConfig[lugarKey] || lugaresConfig.Otro
        const stats = statsPorLugar[lugarKey] || {
          pedidos: 0,
          total: 0,
          productos: 0,
          mp: 0,
          caja: 0,
        }

        const isOpen = openLugar === lugarKey

        return (
          <Fragment key={lugarKey}>
            {/* HEADER LUGAR */}
            <div
              className="rounded p-3 mb-2"
              style={{
                background: '#eef2f5',
                cursor: 'pointer',
                borderLeft: `6px solid ${cfg.color}`,
              }}
              onClick={() => setOpenLugar(isOpen ? null : lugarKey)}
            >
              <div className="d-flex justify-content-between">
                {comprasLugar[0]?.nombreEvento && (
                  <div style={{ fontSize: '.75rem', color: '#555' }}>
                    Evento: <b>{comprasLugar[0].nombreEvento}</b>
                  </div>
                )}
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>

              <div style={{ fontSize: '.85rem' }}>
                <b>{stats.pedidos}</b> pedidos • <b>{stats.productos}</b>{' '}
                productos • <b>${stats.total}</b> recaudado
              </div>

              <div style={{ fontSize: '.78rem', marginTop: 4, color: '#555' }}>
                MP: <b>${stats.mp}</b> • Caja: <b>${stats.caja}</b>
              </div>

              <button
                className="btn btn-sm btn-outline-success mt-2"
                onClick={e => {
                  e.stopPropagation()
                  exportarCSVCompras(cfg.label, comprasLugar)
                }}
              >
                Exportar CSV
              </button>
            </div>

            {/* PEDIDOS DEL LUGAR */}
            {isOpen &&
              comprasLugar.map(p => {
                const metodo = obtenerMetodoPago(p)
                const fecha = formatearFecha(p.creadoEn || p.fecha)

                const totalProductos = Array.isArray(p.items)
                  ? p.items.reduce(
                      (a, it) => a + Number(it.enCarrito || it.cantidad || 0),
                      0
                    )
                  : 0

                return (
                  <div
                    key={p.id}
                    className="p-3 mb-3 rounded"
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${cfg.color}30`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* HEADER PEDIDO */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: '1rem', color: '#111' }}
                        >
                          Pedido #{p.numeroPedido || '-'}
                        </div>

                        {p.nombreEvento && (
                          <div
                            style={{
                              fontSize: '.8rem',
                              color: '#666',
                              marginTop: 2,
                            }}
                          >
                            🎉 {p.nombreEvento}
                            {formatearFechaEvento(p.fechaEvento) && (
                              <> — {formatearFechaEvento(p.fechaEvento)}</>
                            )}
                          </div>
                        )}

                        <div style={{ fontSize: '.8rem', color: '#555' }}>
                          Cliente:{' '}
                          <span style={{ fontWeight: 500 }}>
                            {p.usuarioNombre || 'Usuario'}
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <BadgeEstado estado={p.estado} />
                        <div
                          className="fw-bold"
                          style={{
                            fontSize: '1.05rem',
                            color: '#000',
                            marginTop: 4,
                          }}
                        >
                          Total: ${p.total || 0}
                        </div>
                      </div>
                    </div>

                    {/* META INFO */}
                    <div
                      className="d-flex flex-wrap align-items-center gap-2 mb-2"
                      style={{ fontSize: '.8rem', color: '#555' }}
                    >
                      <span>Fecha: {fecha}</span>
                      <span>•</span>
                      <span>Productos: {totalProductos}</span>
                      <span>•</span>
                      <ChipMetodo metodo={metodo} />
                    </div>

                    {/* ITEMS */}
                    {Array.isArray(p.items) && p.items.length > 0 && (
                      <div
                        className="mt-2"
                        style={{ fontSize: '.85rem', color: '#333' }}
                      >
                        {p.items.map((it, idx) => {
                          const cant = Number(it.enCarrito || it.cantidad || 0)
                          const subtotal = cant * (it.precio || 0)
                          return (
                            <div
                              key={idx}
                              className="d-flex justify-content-between py-1 border-top"
                              style={{
                                borderColor: '#f0f2f5',
                              }}
                            >
                              <div>
                                {it.nombre || 'Producto'}{' '}
                                <span className="text-muted">×{cant}</span>
                              </div>
                              <div className="fw-semibold">${subtotal}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </Fragment>
        )
      })}

      {Object.keys(porLugar).length === 0 && (
        <p className="text-muted mt-3">
          No hay compras para los filtros seleccionados.
        </p>
      )}
    </div>
  )
}
