// --------------------------------------------------------------
// src/components/admin/ComprasAdmin.jsx — PANEL COMPRAS ADMIN 2025
// --------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  updateDoc as firestoreUpdateDoc,
  getDoc,
} from 'firebase/firestore'
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
      return { bg: '#fff3cd', text: '#856404', border: '#ffeeba' } // amarillo
    case 'pagado':
      return { bg: '#d4edda', text: '#155724', border: '#c3e6cb' } // verde
    case 'retirado':
      return { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' } // celeste
    default:
      return { bg: '#f8f9fa', text: '#6c757d', border: '#e2e3e5' }
  }
}

// --------------------------------------------------------------
// DEVOLVER STOCK AL CANCELAR PEDIDO (ADMIN)
// --------------------------------------------------------------
async function devolverStockAdmin(items = []) {
  if (!Array.isArray(items)) return

  for (const item of items) {
    const prodId = item.productoId || item.id
    const cantidad = Number(item.cantidad || item.enCarrito) || 0
    if (!prodId || !cantidad) continue

    try {
      const ref = doc(db, 'productos', prodId)
      const snap = await getDoc(ref)
      if (!snap.exists()) continue

      const data = snap.data()
      const nuevoStock = (data.stock || 0) + cantidad

      await firestoreUpdateDoc(ref, { stock: nuevoStock })
    } catch (err) {
      console.error('❌ Error al devolver stock (admin):', err)
    }
  }
}

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
export default function ComprasAdmin() {
  const [compras, setCompras] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [orden, setOrden] = useState('recientes')
  const [cargando, setCargando] = useState(true)

  // ------------------------------------------------------------
  // LISTENER GLOBAL DE COMPRAS
  // ------------------------------------------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'compras'), snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }))
      setCompras(docs)
      setCargando(false)
    })

    return () => unsub()
  }, [])

  // ------------------------------------------------------------
  // CÁLCULOS / MÉTRICAS + FILTRO + ORDEN
  // ------------------------------------------------------------
  const {
    comprasProcesadas,
    totalRecaudado,
    totalPendiente,
    totalPagado,
    totalRetirado,
  } = useMemo(() => {
    let arr = [...compras]

    const b = normalizarTexto(busqueda)

    if (b !== '') {
      arr = arr.filter(c => {
        const nUsuario = normalizarTexto(c.usuarioNombre)
        const nLugar = normalizarTexto(c.lugar)
        const nNum = String(c.numeroPedido || '').toLowerCase()

        return (
          nUsuario.includes(b) ||
          nLugar.includes(b) ||
          nNum.includes(b) ||
          normalizarTexto(c.estado).includes(b)
        )
      })
    }

    if (filtroEstado !== 'todos') {
      arr = arr.filter(c => c.estado === filtroEstado)
    }

    // ORDEN
    arr.sort((a, b) => {
      const fechaA =
        a.creadoEn?.toDate?.() ??
        a.fecha?.toDate?.() ??
        (a.fecha ? new Date(a.fecha) : new Date(0))
      const fechaB =
        b.creadoEn?.toDate?.() ??
        b.fecha?.toDate?.() ??
        (b.fecha ? new Date(b.fecha) : new Date(0))

      const totalA = a.total || 0
      const totalB = b.total || 0

      const userA = normalizarTexto(a.usuarioNombre)
      const userB = normalizarTexto(b.usuarioNombre)

      switch (orden) {
        case 'montoDesc':
          return totalB - totalA
        case 'montoAsc':
          return totalA - totalB
        case 'clienteAZ':
          return userA.localeCompare(userB)
        case 'recientes':
        default:
          return fechaB - fechaA
      }
    })

    // MÉTRICAS
    const totalRecaudado = arr.reduce((acc, c) => acc + (c.total || 0), 0)
    const totalPendiente = arr
      .filter(c => c.estado === 'pendiente')
      .reduce((acc, c) => acc + (c.total || 0), 0)
    const totalPagado = arr
      .filter(c => c.estado === 'pagado')
      .reduce((acc, c) => acc + (c.total || 0), 0)
    const totalRetirado = arr
      .filter(c => c.estado === 'retirado')
      .reduce((acc, c) => acc + (c.total || 0), 0)

    return {
      comprasProcesadas: arr,
      totalRecaudado,
      totalPendiente,
      totalPagado,
      totalRetirado,
    }
  }, [compras, busqueda, filtroEstado, orden])

  // ------------------------------------------------------------
  // ACCIONES ADMIN
  // ------------------------------------------------------------
  async function marcarEstado(compra, nuevoEstado) {
    try {
      const ref = doc(db, 'compras', compra.id)
      await updateDoc(ref, {
        estado: nuevoEstado,
        pagado: nuevoEstado !== 'pendiente',
      })
    } catch (err) {
      console.error('❌ Error actualizando estado de compra:', err)
    }
  }

  async function cancelarCompra(compra) {
    const ok = window.confirm(
      `¿Seguro que querés cancelar el pedido #${compra.numeroPedido}? Se devolverá el stock y se eliminará la compra.`
    )
    if (!ok) return

    try {
      await devolverStockAdmin(compra.items || [])
      await deleteDoc(doc(db, 'compras', compra.id))
    } catch (err) {
      console.error('❌ Error cancelando compra:', err)
    }
  }

  async function eliminarCompraDefinitivo(compra) {
    const ok = window.confirm(
      `¿Eliminar definitivamente el pedido #${compra.numeroPedido}?`
    )
    if (!ok) return

    try {
      await deleteDoc(doc(db, 'compras', compra.id))
    } catch (err) {
      console.error('❌ Error eliminando compra:', err)
    }
  }

  // ------------------------------------------------------------
  // EXPORT CSV GLOBAL (todas las compras filtradas)
  // ------------------------------------------------------------
  function exportarCSV() {
    const data = comprasProcesadas
    if (!data.length) return

    let csv = 'numero_pedido,cliente,lugar,estado,total,fecha,items\n'

    data.forEach(c => {
      const fecha = formatearFechaCompra(c)
      const itemsText = (c.items || [])
        .map(i => `${i.nombre} x${i.enCarrito} ($${i.precio})`)
        .join(' | ')

      csv += `${c.numeroPedido || '-'},${c.usuarioNombre || '-'},${
        c.lugar || '-'
      },${c.estado || '-'},${c.total || 0},${fecha},"${itemsText}"\n`
    })

    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'compras_filtradas.csv'
    link.click()
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  if (cargando) {
    return <p>Cargando compras...</p>
  }

  return (
    <div>
      <h4 className="fw-bold mb-3">Compras - Administración</h4>

      {/* MÉTRICAS RESUMEN */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="p-2 rounded bg-dark text-white text-center">
            <div style={{ fontSize: '.8rem' }}>Recaudado total</div>
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              ${totalRecaudado}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-2 rounded bg-warning-subtle text-center">
            <div style={{ fontSize: '.8rem' }}>Pendiente</div>
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              ${totalPendiente}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-2 rounded bg-success-subtle text-center">
            <div style={{ fontSize: '.8rem' }}>Pagado</div>
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              ${totalPagado}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-2 rounded bg-info-subtle text-center">
            <div style={{ fontSize: '.8rem' }}>Retirado</div>
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              ${totalRetirado}
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS / CONTROLES */}
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <input
          className="form-control"
          style={{ maxWidth: 260 }}
          placeholder="Buscar por cliente, pedido, lugar..."
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
          style={{ maxWidth: 200 }}
          value={orden}
          onChange={e => setOrden(e.target.value)}
        >
          <option value="recientes">Más recientes</option>
          <option value="montoDesc">Monto (alto → bajo)</option>
          <option value="montoAsc">Monto (bajo → alto)</option>
          <option value="clienteAZ">Cliente (A → Z)</option>
        </select>

        <button
          className="btn btn-outline-success ms-auto"
          onClick={exportarCSV}
          disabled={!comprasProcesadas.length}
        >
          Exportar CSV (filtradas)
        </button>
      </div>

      {/* LISTA DE COMPRAS */}
      {comprasProcesadas.length === 0 && (
        <p className="text-muted">No hay compras con los filtros actuales.</p>
      )}

      <div className="d-flex flex-column gap-2">
        {comprasProcesadas.map(compra => {
          const { bg, text, border } = colorEstado(compra.estado)
          const fecha = formatearFechaCompra(compra)
          const items = compra.items || []

          return (
            <div
              key={compra.id}
              className="p-3 rounded"
              style={{
                background: '#ffffff',
                border: `1px solid #dee2e6`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* HEADER COMPRA */}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <strong style={{ fontSize: '1.05rem' }}>
                      Pedido #{compra.numeroPedido || '-'}
                    </strong>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: bg,
                        color: text,
                        border: `1px solid ${border}`,
                      }}
                    >
                      {compra.estado?.toUpperCase?.() || 'SIN ESTADO'}
                    </span>
                  </div>

                  <div style={{ fontSize: '.8rem', color: '#555' }}>
                    Cliente: <b>{compra.usuarioNombre || 'Usuario'}</b> • Lugar:{' '}
                    <b>{compra.lugar || '-'}</b>
                  </div>
                  <div style={{ fontSize: '.78rem', color: '#777' }}>
                    Fecha: {fecha}
                  </div>
                </div>

                {/* TOTAL */}
                <div className="text-end">
                  <div
                    className="fw-bold"
                    style={{ fontSize: '1.1rem', color: '#000' }}
                  >
                    Total: ${compra.total || 0}
                  </div>
                  <div style={{ fontSize: '.8rem', color: '#555' }}>
                    {items.reduce(
                      (acc, it) => acc + (it.enCarrito || it.cantidad || 0),
                      0
                    )}{' '}
                    ítems
                  </div>
                </div>
              </div>

              {/* ITEMS */}
              <div
                className="mt-2"
                style={{ borderTop: '1px solid #f1f3f5', paddingTop: 8 }}
              >
                {items.map((it, idx) => {
                  const cant = it.enCarrito || it.cantidad || 0
                  const subtotal = (it.precio || 0) * cant
                  return (
                    <div
                      key={idx}
                      className="d-flex justify-content-between align-items-center py-1"
                      style={{
                        fontSize: '.85rem',
                        borderBottom:
                          idx === items.length - 1
                            ? 'none'
                            : '1px solid #f1f3f5',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {it.nombre || 'Producto'}
                        </div>
                        <div style={{ color: '#777', fontSize: '.78rem' }}>
                          x{cant} • ${it.precio || 0} c/u
                        </div>
                      </div>
                      <div className="fw-bold" style={{ color: '#198754' }}>
                        +${subtotal}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ACCIONES ADMIN */}
              <div className="d-flex gap-2 mt-3 justify-content-end">
                {compra.estado === 'pendiente' && (
                  <>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => marcarEstado(compra, 'pagado')}
                    >
                      Marcar como pagado
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => cancelarCompra(compra)}
                    >
                      Cancelar (devuelve stock)
                    </button>
                  </>
                )}

                {compra.estado === 'pagado' && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => marcarEstado(compra, 'retirado')}
                  >
                    Marcar como retirado
                  </button>
                )}

                {/* Eliminar siempre disponible */}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => eliminarCompraDefinitivo(compra)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
