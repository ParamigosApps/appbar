// --------------------------------------------------------------
// src/components/admin/DashboardVentas.jsx — EVENTOS PRO COLLAPSIBLE
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase'
import Swal from 'sweetalert2'
import './dashboard.css'

// Helper robusto
function toDateSafe(v) {
  if (!v) return null
  if (v.seconds) return new Date(v.seconds * 1000)
  if (typeof v === 'string') return new Date(v)
  if (v instanceof Date) return v
  return null
}

export default function DashboardVentas() {
  const [eventos, setEventos] = useState([])
  const [entradas, setEntradas] = useState([])
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')

  // ============================================================
  // CARGA DE TODO
  // ============================================================
  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true)

        const snapEventos = await getDocs(collection(db, 'eventos'))
        const snapEntradas = await getDocs(
          query(collection(db, 'entradas'), orderBy('creadoEn', 'asc'))
        )
        const snapCompras = await getDocs(
          query(collection(db, 'compras'), orderBy('creadoEn', 'asc'))
        )

        setEventos(snapEventos.docs.map(d => ({ id: d.id, ...d.data() })))
        setEntradas(snapEntradas.docs.map(d => ({ id: d.id, ...d.data() })))
        setCompras(snapCompras.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error')
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  // ============================================================
  // FUNCIÓN: AGRUPAR DATOS DE UN EVENTO
  // ============================================================
  function dataEvento(ev) {
    const entradasEv = entradas.filter(e => e.eventoId === ev.id)
    const comprasEv = compras.filter(c => c.eventoId === ev.id)

    const recaudEntradas = entradasEv.reduce((a, e) => a + (e.precio || 0), 0)
    const recaudBar = comprasEv.reduce((a, c) => a + (c.total || 0), 0)

    const usadas = entradasEv.filter(e => e.usado).length

    const volumenBar = comprasEv.reduce((acc, c) => {
      if (!Array.isArray(c.items)) return acc
      return acc + c.items.reduce((s, it) => s + (it.enCarrito || 0), 0)
    }, 0)

    const compradoresUnicos = new Set(entradasEv.map(e => e.usuarioId)).size

    return {
      entradasEv,
      comprasEv,
      recaudEntradas,
      recaudBar,
      totalRecaudado: recaudEntradas + recaudBar,
      usadas,
      sinUsar: entradasEv.length - usadas,
      volumenBar,
      compradoresUnicos,
    }
  }

  // ============================================================
  // EXPORTAR CSV INDIVIDUAL
  // ============================================================
  function exportarEventoCSV(ev, data) {
    const filas = []
    filas.push(`=== EVENTO ${ev.nombre} ===`)
    filas.push('Tipo,Usuario,Precio,Cantidad,Fecha')

    data.entradasEv.forEach(e => {
      filas.push(
        ['Entrada', e.usuarioNombre, e.precio, e.cantidad || 1, e.fecha].join(
          ','
        )
      )
    })

    data.comprasEv.forEach(c => {
      filas.push(
        [
          'CompraBar',
          c.usuarioNombre,
          c.total,
          (c.items || []).reduce((a, it) => a + (it.enCarrito || 0), 0),
          c.creadoEn,
        ].join(',')
      )
    })

    const blob = new Blob([filas.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evento_${ev.nombre}.csv`
    a.click()
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) return <p className="p-3">Cargando datos…</p>

  return (
    <div className="dashboard pro-dashboard">
      <h2 className="mb-3">📊 Panel de Eventos</h2>

      <input
        type="text"
        className="form-control mb-3"
        placeholder="Buscar evento, cliente, pedido…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {eventos
        .filter(ev => ev.nombre.toLowerCase().includes(search.toLowerCase()))
        .map(ev => {
          const d = dataEvento(ev)

          return (
            <div key={ev.id} className="evento-card">
              {/* CABECERA */}
              <div
                className="evento-header"
                data-bs-toggle="collapse"
                data-bs-target={`#ev-${ev.id}`}
              >
                <div>
                  <h4>{ev.nombre}</h4>
                  <small>
                    {ev.fecha} — {ev.lugar}
                  </small>
                </div>

                {/* DATOS A LA DERECHA */}
                <div className="evento-stats">
                  <span className="stat-item">
                    🎟 {d.entradasEv.length} entradas
                  </span>
                  <span className="stat-item">✅ {d.usadas} usadas</span>
                  <span className="stat-item">⏳ {d.sinUsar} sin usar</span>
                  <span className="stat-item">🍾 {d.volumenBar} ítems bar</span>
                  <span className="stat-item money">
                    💰 ${d.totalRecaudado.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* DETALLE PLEGABLE */}
              <div id={`ev-${ev.id}`} className="collapse evento-body">
                <h5 className="mt-3">📌 Detalle</h5>

                <div className="detalle-grid">
                  <div>
                    <h6>🎟 Entradas</h6>
                    {d.entradasEv.map(e => (
                      <div key={e.id} className="detalle-item">
                        {e.usuarioNombre} — ${e.precio} —{' '}
                        {e.usado ? 'Usada' : 'Sin usar'}
                      </div>
                    ))}
                  </div>

                  <div>
                    <h6>🍹 Compras Bar</h6>
                    {d.comprasEv.map(c => (
                      <div key={c.id} className="detalle-item">
                        {c.usuarioNombre} — ${c.total}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-success mt-3"
                  onClick={() => exportarEventoCSV(ev, d)}
                >
                  ⬇ Exportar CSV evento
                </button>
              </div>
            </div>
          )
        })}
    </div>
  )
}
