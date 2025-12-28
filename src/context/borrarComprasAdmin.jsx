// --------------------------------------------------------------
// ComprasAdmin.jsx — PANEL COMPRAS ADMIN (ULTRA EFICAZ 2025)
// - Agrupado por evento + KPIs por grupo
// - Caja diaria (cierre + export CSV/PDF)
// - Cierre de evento (cierre + export CSV/PDF)
// - Alertas: pendientes vencidos / pagados no retirados
// - Export global CSV/PDF
// - Mantiene TODAS tus funciones base: marcarEstado, cancelarCompra, eliminarCompra, devolverStockAdmin
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

// ✅ Service core (cierres + métricas)
import {
  calcularMetricas,
  agruparComprasPorEvento,
  generarCierreCaja,
  generarCierreEvento,
  existeCierreCaja,
  existeCierreEvento,
} from '../../services/reportesService.js'

// ✅ PDF client-side
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

function formatearSoloFecha(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-AR', { dateStyle: 'short' })
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

function toISODate(d) {
  const x = new Date(d)
  return x.toISOString().slice(0, 10)
}

function safeMoney(n) {
  const v = Number(n || 0)
  return isNaN(v) ? 0 : v
}

// --------------------------------------------------------------
// DEVOLVER STOCK (ADMIN) — mantiene tu lógica
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
// EXPORT: CSV
// --------------------------------------------------------------
function descargarCSV(nombreArchivo, rows, headers) {
  const sep = ';' // 👈 clave
  const headerLine = headers.join(sep)

  const body = rows
    .map(r =>
      headers
        .map(h => {
          const val = r[h] ?? ''
          return `"${String(val).replace(/"/g, '""')}"`
        })
        .join(sep)
    )
    .join('\n')

  const csv = headerLine + '\n' + body

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombreArchivo
  a.click()
}

// --------------------------------------------------------------
// EXPORT: PDF (jsPDF + autotable)
// --------------------------------------------------------------
function exportarPDF({
  titulo,
  subtitulo,
  metricas,
  rows,
  filename = 'reporte.pdf',
}) {
  const docPdf = new jsPDF({ unit: 'pt', format: 'a4' })

  const marginX = 40
  let y = 46

  docPdf.setFont('helvetica', 'bold')
  docPdf.setFontSize(14)
  docPdf.text(titulo || 'Reporte', marginX, y)
  y += 18

  if (subtitulo) {
    docPdf.setFont('helvetica', 'normal')
    docPdf.setFontSize(10)
    docPdf.text(subtitulo, marginX, y)
    y += 16
  }

  if (metricas) {
    docPdf.setFont('helvetica', 'bold')
    docPdf.setFontSize(10)
    const line = `Pedidos: ${metricas.pedidos} | Total: $${safeMoney(
      metricas.total
    )} | Pendiente: $${safeMoney(metricas.pendiente)} | Pagado: $${safeMoney(
      metricas.pagado
    )} | Retirado: $${safeMoney(metricas.retirado)}`
    docPdf.text(line, marginX, y)
    y += 16
  }

  const head = [
    ['Pedido', 'Cliente', 'Evento', 'Estado', 'Total', 'Fecha', 'Código', 'QR'],
  ]

  const body = (rows || []).map(r => [
    r.numeroPedido ?? '-',
    r.usuarioNombre ?? '-',
    r.nombreEvento ?? '-',
    r.estado ?? '-',
    `$${safeMoney(r.total)}`,
    formatearFechaCompra(r),
    r.ticketId || r.id || '-',
    r.qrUrl ? 'SI' : 'NO',
  ])

  autoTable(docPdf, {
    startY: y,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30] },
    margin: { left: marginX, right: marginX },
  })

  docPdf.save(filename)
}

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
export default function ComprasAdmin() {
  const { empleado } = useAuth()
  const nivel = Number(empleado?.nivel || 0)

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

  // Caja diaria: fecha puntual para cierre
  const [fechaCaja, setFechaCaja] = useState(() => toISODate(new Date()))

  const [procesando, setProcesando] = useState(false)

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
  // PROCESAMIENTO GENERAL
  // ------------------------------------------------------------
  const comprasProcesadas = useMemo(() => {
    let arr = [...compras]
    const b = normalizarTexto(busqueda)

    if (b) {
      arr = arr.filter(c =>
        [
          c.usuarioNombre,
          c.numeroPedido,
          c.estado,
          c.nombreEvento,
          c.ticketId,
          c.id,
        ]
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
      return f && f >= fechaDesde && f <= fechaHasta
    })

    arr.sort((a, b) => {
      const fa = a.creadoEn?.toMillis?.() || 0
      const fb = b.creadoEn?.toMillis?.() || 0

      if (orden === 'montoDesc') return safeMoney(b.total) - safeMoney(a.total)
      if (orden === 'montoAsc') return safeMoney(a.total) - safeMoney(b.total)
      return fb - fa
    })

    return arr
  }, [
    compras,
    busqueda,
    filtroEstado,
    eventoSel,
    fechaDesde,
    fechaHasta,
    orden,
  ])

  // ------------------------------------------------------------
  // MÉTRICAS GENERALES (para el rango filtrado)
  // ------------------------------------------------------------
  const metricasGlobales = useMemo(
    () => calcularMetricas(comprasProcesadas),
    [comprasProcesadas]
  )

  // ------------------------------------------------------------
  // ALERTAS OPERATIVAS
  // ------------------------------------------------------------
  const pendientesVencidos = useMemo(() => {
    const ahora = new Date()
    return comprasProcesadas.filter(
      c =>
        c.estado === 'pendiente' &&
        c.expiraEn?.toDate &&
        c.expiraEn.toDate() < ahora
    )
  }, [comprasProcesadas])

  const pagadosNoRetirados = useMemo(
    () => comprasProcesadas.filter(c => c.estado === 'pagado'),
    [comprasProcesadas]
  )

  // ------------------------------------------------------------
  // AGRUPADO POR EVENTO
  // ------------------------------------------------------------
  const comprasPorEvento = useMemo(
    () => agruparComprasPorEvento(comprasProcesadas),
    [comprasProcesadas]
  )

  // ------------------------------------------------------------
  // ACCIONES (mantiene tu lógica + auditoría)
  // ------------------------------------------------------------
  async function marcarEstado(compra, estado) {
    await updateDoc(doc(db, 'compras', compra.id), {
      estado,
      pagado: estado !== 'pendiente',
      audit: [
        ...(compra.audit || []),
        {
          accion: estado,
          por: empleado.nombre,
          uid: empleado.uid,
          nivel,
          fecha: new Date(),
        },
      ],
    })
  }

  async function cancelarCompra(compra) {
    if (nivel < 3) return
    if (!confirm(`Cancelar pedido #${compra.numeroPedido}?`)) return
    await devolverStockAdmin(compra.items || [])
    await deleteDoc(doc(db, 'compras', compra.id))
  }

  async function eliminarCompra(compra) {
    if (nivel !== 4) return
    if (!confirm(`Eliminar DEFINITIVO #${compra.numeroPedido}?`)) return
    await deleteDoc(doc(db, 'compras', compra.id))
  }

  // ------------------------------------------------------------
  // EXPORTACIONES
  // ------------------------------------------------------------
  function exportarCSVGlobal() {
    if (nivel !== 4) return
    const rows = comprasProcesadas.map(c => ({
      pedido: c.numeroPedido,
      cliente: c.usuarioNombre,
      evento: c.nombreEvento || '-',
      estado: c.estado,
      total: safeMoney(c.total),
      fecha: formatearFechaCompra(c),
      codigo: c.ticketId || c.id,
      qr: c.qrUrl ? 'SI' : 'NO',
    }))

    descargarCSV(
      `compras_${toISODate(fechaDesde)}_a_${toISODate(fechaHasta)}.csv`,
      rows,
      [
        'pedido',
        'cliente',
        'evento',
        'estado',
        'total',
        'fecha',
        'codigo',
        'qr',
      ]
    )
  }

  function exportarPDFGlobal() {
    exportarPDF({
      titulo: 'Compras — Reporte Global',
      subtitulo: `Rango: ${formatearSoloFecha(
        fechaDesde
      )} a ${formatearSoloFecha(fechaHasta)}`,
      metricas: metricasGlobales,
      rows: comprasProcesadas,
      filename: `compras_${toISODate(fechaDesde)}_a_${toISODate(
        fechaHasta
      )}.pdf`,
    })
  }

  function exportarCSVEvento(grupo) {
    const rows = (grupo.compras || []).map(c => ({
      pedido: c.numeroPedido,
      cliente: c.usuarioNombre,
      estado: c.estado,
      total: safeMoney(c.total),
      fecha: formatearFechaCompra(c),
      codigo: c.ticketId || c.id,
      qr: c.qrUrl ? 'SI' : 'NO',
    }))

    descargarCSV(
      `compras_evento_${(grupo.nombreEvento || 'evento')
        .replace(/\s+/g, '_')
        .toLowerCase()}.csv`,
      rows,
      ['pedido', 'cliente', 'estado', 'total', 'fecha', 'codigo', 'qr']
    )
  }

  function exportarPDFEvento(grupo) {
    const m = calcularMetricas(grupo.compras || [])
    exportarPDF({
      titulo: `Cierre / Reporte de Evento`,
      subtitulo: `${grupo.nombreEvento || 'Sin evento'} — Fecha evento: ${
        grupo.fechaEvento ? formatearSoloFecha(grupo.fechaEvento) : '-'
      }`,
      metricas: m,
      rows: grupo.compras || [],
      filename: `evento_${(grupo.nombreEvento || 'evento')
        .replace(/\s+/g, '_')
        .toLowerCase()}.pdf`,
    })
  }

  // ------------------------------------------------------------
  // CIERRES
  // ------------------------------------------------------------
  async function cerrarCajaDiaria() {
    if (nivel !== 4) return

    const fecha = new Date(fechaCaja + 'T00:00:00')
    const ya = await existeCierreCaja(fecha)
    if (ya) return alert('⚠️ Ya existe un cierre de caja para esa fecha.')

    const desde = new Date(fecha)
    desde.setHours(0, 0, 0, 0)
    const hasta = new Date(fecha)
    hasta.setHours(23, 59, 59, 999)

    const comprasDia = compras.filter(c => {
      const f =
        c.creadoEn?.toDate?.() ??
        c.fecha?.toDate?.() ??
        (c.fecha ? new Date(c.fecha) : null)
      return f && f >= desde && f <= hasta
    })

    if (!confirm(`Cerrar caja del ${formatearSoloFecha(fecha)}?`)) return

    try {
      setProcesando(true)
      const metricas = await generarCierreCaja({
        fecha,
        compras: comprasDia,
        empleado,
      })

      // PDF automático del cierre (opcional pero recomendado)
      exportarPDF({
        titulo: 'Cierre de Caja Diaria',
        subtitulo: `Fecha: ${formatearSoloFecha(fecha)} — Cerrado por: ${
          empleado.nombre
        }`,
        metricas,
        rows: comprasDia,
        filename: `cierre_caja_${toISODate(fecha)}.pdf`,
      })

      alert('✅ Caja cerrada correctamente (y PDF generado).')
    } catch (err) {
      alert(err.message || 'Error cerrando caja')
    } finally {
      setProcesando(false)
    }
  }

  async function cerrarEvento(grupo) {
    if (nivel !== 4) return
    if (!grupo?.eventoId) return alert('Evento inválido')

    const ya = await existeCierreEvento(grupo.eventoId)
    if (ya) return alert('⚠️ Este evento ya tiene cierre.')

    if (!confirm(`Cerrar evento: ${grupo.nombreEvento}?`)) return

    try {
      setProcesando(true)

      const metricas = await generarCierreEvento({
        eventoId: grupo.eventoId,
        nombreEvento: grupo.nombreEvento,
        fechaEvento: grupo.fechaEvento || null,
        compras: grupo.compras || [],
        empleado,
      })

      // PDF automático del evento
      exportarPDF({
        titulo: 'Cierre de Evento',
        subtitulo: `${grupo.nombreEvento} — Fecha evento: ${
          grupo.fechaEvento ? formatearSoloFecha(grupo.fechaEvento) : '-'
        } — Cerrado por: ${empleado.nombre}`,
        metricas,
        rows: grupo.compras || [],
        filename: `cierre_evento_${grupo.eventoId}.pdf`,
      })

      alert('✅ Evento cerrado correctamente (y PDF generado).')
    } catch (err) {
      alert(err.message || 'Error cerrando evento')
    } finally {
      setProcesando(false)
    }
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  if (cargando) return <p>Cargando compras...</p>

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h4 className="fw-bold mb-0">🧾 Compras — Administración</h4>

        <div className="d-flex flex-wrap gap-2">
          {nivel === 4 && (
            <>
              <button
                className="btn btn-outline-success"
                onClick={exportarCSVGlobal}
                disabled={procesando}
              >
                Exportar CSV
              </button>
              <button
                className="btn btn-outline-dark"
                onClick={exportarPDFGlobal}
                disabled={procesando}
              >
                Exportar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ALERTAS OPERATIVAS */}
      {(pendientesVencidos.length > 0 || pagadosNoRetirados.length > 0) && (
        <div className="row g-2 mb-3">
          {pendientesVencidos.length > 0 && (
            <div className="col-12 col-md-6">
              <div className="alert alert-warning mb-0">
                ⚠️ Pendientes vencidos en este filtro:{' '}
                <b>{pendientesVencidos.length}</b>
              </div>
            </div>
          )}
          {pagadosNoRetirados.length > 0 && (
            <div className="col-12 col-md-6">
              <div className="alert alert-info mb-0">
                ℹ️ Pagados no retirados en este filtro:{' '}
                <b>{pagadosNoRetirados.length}</b>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIS */}
      <div className="row g-2 mb-3">
        <Metric title="Pedidos" value={metricasGlobales.pedidos} />
        <Metric title="Recaudado" value={metricasGlobales.total} />
        <Metric title="Pendiente" value={metricasGlobales.pendiente} />
        <Metric title="Pagado" value={metricasGlobales.pagado} />
        <Metric title="Retirado" value={metricasGlobales.retirado} />
      </div>

      {/* CONTROLES */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Buscar (cliente, pedido, estado, evento, código)..."
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
          style={{ maxWidth: 220 }}
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
          style={{ maxWidth: 170 }}
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="retirado">Retirado</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 170 }}
          value={orden}
          onChange={e => setOrden(e.target.value)}
        >
          <option value="recientes">Más recientes</option>
          <option value="montoDesc">Mayor monto</option>
          <option value="montoAsc">Menor monto</option>
        </select>
      </div>

      {/* CAJA DIARIA (solo dueño) */}
      {nivel === 4 && (
        <div className="card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-end gap-2 justify-content-between">
            <div>
              <div className="fw-bold">🧾 Caja diaria</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Cierra la caja por día (inmutable) y genera PDF automáticamente.
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-end">
              <div>
                <div style={{ fontSize: 12 }} className="text-muted">
                  Fecha
                </div>
                <input
                  type="date"
                  className="form-control"
                  value={fechaCaja}
                  onChange={e => setFechaCaja(e.target.value)}
                  style={{ maxWidth: 170 }}
                  disabled={procesando}
                />
              </div>

              <button
                className="btn btn-dark"
                onClick={cerrarCajaDiaria}
                disabled={procesando}
              >
                {procesando ? 'Procesando...' : 'Cerrar caja + PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTADO AGRUPADO POR EVENTO */}
      {comprasPorEvento.map(grupo => {
        const m = calcularMetricas(grupo.compras || [])
        const fechaEv = grupo.fechaEvento
          ? formatearSoloFecha(grupo.fechaEvento)
          : null

        return (
          <div key={grupo.eventoId || 'sin'} className="mb-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <h5 className="fw-bold mb-0">
                🎉 {grupo.nombreEvento}{' '}
                {fechaEv && (
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    ({fechaEv})
                  </span>
                )}
              </h5>

              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-sm btn-outline-success"
                  onClick={() => exportarCSVEvento(grupo)}
                  disabled={procesando}
                >
                  CSV evento
                </button>
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => exportarPDFEvento(grupo)}
                  disabled={procesando}
                >
                  PDF evento
                </button>

                {nivel === 4 && grupo.eventoId && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => cerrarEvento(grupo)}
                    disabled={procesando}
                  >
                    Cerrar evento + PDF
                  </button>
                )}
              </div>
            </div>

            <div className="text-muted mb-2" style={{ fontSize: 13 }}>
              Pedidos: <b>{m.pedidos}</b> · Total: <b>${safeMoney(m.total)}</b>{' '}
              · Pendiente: <b>${safeMoney(m.pendiente)}</b> · Pagado:{' '}
              <b>${safeMoney(m.pagado)}</b> · Retirado:{' '}
              <b>${safeMoney(m.retirado)}</b>
            </div>

            {(grupo.compras || []).map(c => (
              <div key={c.id} className="card p-3 mb-2">
                <div className="d-flex justify-content-between gap-2">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <strong>Pedido #{c.numeroPedido}</strong>
                      <span className={`badge bg-${colorEstado(c.estado)}`}>
                        {c.estado}
                      </span>

                      {/* Código manual para validación */}
                      <span className="badge bg-secondary">
                        Código: {c.ticketId || c.id}
                      </span>

                      {/* Estado QR */}
                      {c.qrUrl ? (
                        <span className="badge bg-success">QR: SI</span>
                      ) : (
                        <span className="badge bg-danger">QR: NO</span>
                      )}
                    </div>

                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {c.usuarioNombre} • {formatearFechaCompra(c)}
                    </div>
                  </div>

                  <div className="fw-bold">${safeMoney(c.total)}</div>
                </div>

                <div className="d-flex flex-wrap gap-2 justify-content-end mt-2">
                  {c.estado === 'pendiente' && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => marcarEstado(c, 'pagado')}
                      disabled={procesando}
                    >
                      Marcar pagado
                    </button>
                  )}
                  {c.estado === 'pagado' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => marcarEstado(c, 'retirado')}
                      disabled={procesando}
                    >
                      Marcar retirado
                    </button>
                  )}
                  {nivel >= 3 && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => cancelarCompra(c)}
                      disabled={procesando}
                    >
                      Cancelar
                    </button>
                  )}
                  {nivel === 4 && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => eliminarCompra(c)}
                      disabled={procesando}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// --------------------------------------------------------------
function Metric({ title, value }) {
  return (
    <div className="col-6 col-md-3">
      <div className="p-2 bg-light rounded text-center">
        <div style={{ fontSize: 12 }}>{title}</div>
        <div className="fw-bold">
          {title === 'Pedidos' ? value : `$${safeMoney(value)}`}
        </div>
      </div>
    </div>
  )
}
