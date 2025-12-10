// --------------------------------------------------------------
// DashboardEventos.jsx — PANEL DE EVENTOS PRO
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase.js'
import Swal from 'sweetalert2'
import './dashboard.css'

export default function DashboardEventos() {
  const [eventos, setEventos] = useState([])
  const [entradas, setEntradas] = useState([])
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)

  // ============================================================
  // CARGA GENERAL
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
        Swal.fire('Error', 'No se pudo cargar la información.', 'error')
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  // ============================================================
  // AGRUPAR DATOS POR EVENTO
  // ============================================================
  function resumenEvento(evento) {
    const entradasEvento = entradas.filter(e => e.eventoId === evento.id)
    const comprasEvento = compras.filter(c => c.eventoId === evento.id)

    const recaudacionEntradas = entradasEvento.reduce(
      (acc, e) => acc + (e.precio || 0),
      0
    )

    const volumenVendido = comprasEvento.reduce((acc, c) => {
      if (!Array.isArray(c.items)) return acc
      return acc + c.items.reduce((k, it) => k + (it.enCarrito || 0), 0)
    }, 0)

    const recaudacionBar = comprasEvento.reduce(
      (acc, c) => acc + (c.total || 0),
      0
    )

    return {
      entradasVendidas: entradasEvento.length,
      compradoresUnicos: new Set(entradasEvento.map(e => e.usuarioId)).size,
      volumenVendido,
      recaudacionTotal: recaudacionBar + recaudacionEntradas,
      entradasEvento,
      comprasEvento,
    }
  }

  // ============================================================
  // EXPORTAR CSV ÚNICO DEL EVENTO
  // ============================================================
  function exportarEventoCSV(evento, data) {
    const filas = []

    filas.push(`=== EVENTO: ${evento.nombre} ===`)
    filas.push('Tipo,Usuario,Precio,Cantidad,Fecha')

    // Entradas
    data.entradasEvento.forEach(e => {
      filas.push(
        [
          'Entrada',
          e.usuarioNombre || '',
          e.precio || 0,
          e.cantidad || 1,
          e.fecha,
        ].join(',')
      )
    })

    // Compras del bar
    data.comprasEvento.forEach(c => {
      filas.push(
        [
          'Compra Bar',
          c.usuarioNombre || '',
          c.total || 0,
          (c.items || []).reduce((a, it) => a + (it.enCarrito || 0), 0),
          c.creadoEn,
        ].join(',')
      )
    })

    const blob = new Blob([filas.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evento_${evento.nombre}.csv`
    a.click()
  }

  if (loading) return <p className="p-3">Cargando eventos...</p>

  return (
    <div className="dashboard pro-dashboard">
      <h2 className="mb-3">🎉 Panel de Eventos</h2>

      {eventos.map(ev => {
        const info = resumenEvento(ev)

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

              <div className="evento-stats">
                <span className="stat-item">
                  🎟 {info.entradasVendidas} entradas
                </span>
                <span className="stat-item">
                  🧍 {info.compradoresUnicos} clientes
                </span>
                <span className="stat-item">
                  🍾 {info.volumenVendido} ítems bar
                </span>
                <span className="stat-item money">
                  💰 ${info.recaudacionTotal.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* DETALLE PLEGABLE */}
            <div id={`ev-${ev.id}`} className="collapse evento-body">
              <h5 className="mt-3">📊 Detalle del evento</h5>

              <div className="detalle-grid">
                <div>
                  <h6>🎟 Entradas</h6>
                  {info.entradasEvento.map(e => (
                    <div key={e.id} className="detalle-item">
                      {e.usuarioNombre} — ${e.precio}
                    </div>
                  ))}
                </div>

                <div>
                  <h6>🍹 Compras Bar</h6>
                  {info.comprasEvento.map(c => (
                    <div key={c.id} className="detalle-item">
                      {c.usuarioNombre} — ${c.total}
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-success mt-3"
                onClick={() => exportarEventoCSV(ev, info)}
              >
                ⬇ Exportar CSV del evento
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
