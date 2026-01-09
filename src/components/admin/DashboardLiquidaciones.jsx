// --------------------------------------------------------------
// src/components/admin/DashboardLiquidaciones.jsx
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase'
import Swal from 'sweetalert2'
import './dashboard.css'

export default function DashboardLiquidaciones() {
  const [pagos, setPagos] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [procesando, setProcesando] = useState({})
  // ============================================================
  // CARGA INICIAL
  // ============================================================
  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true)

        const snapEventos = await getDocs(collection(db, 'eventos'))
        const snapPagos = await getDocs(
          query(
            collection(db, 'pagos'),
            where('estado', '==', 'pagado'),
            orderBy('updatedAt', 'desc')
          )
        )

        setEventos(snapEventos.docs.map(d => ({ id: d.id, ...d.data() })))
        setPagos(snapPagos.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error(e)
        Swal.fire('Error', 'No se pudieron cargar las liquidaciones', 'error')
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  // ============================================================
  // AGRUPAR POR EVENTO
  // ============================================================
  function dataEvento(eventoId) {
    const pagosEvento = pagos.filter(p => p.eventoId === eventoId)

    const totalCobrado = pagosEvento.reduce(
      (a, p) => a + Number(p.totalCobrado || 0),
      0
    )

    const totalBase = pagosEvento.reduce(
      (a, p) => a + Number(p.totalBase || 0),
      0
    )

    const totalComision = pagosEvento.reduce(
      (a, p) => a + Number(p.totalComision || 0),
      0
    )

    const pendientes = pagosEvento.filter(p => !p.liquidado).length

    return {
      pagosEvento,
      totalCobrado,
      totalBase,
      totalComision,
      cantidadPagos: pagosEvento.length,
      pendientes,
    }
  }

  if (loading) return <p className="p-3">Cargando liquidaciones…</p>

  return (
    <div className="dashboard pro-dashboard">
      <h2 className="mb-3">💰 Liquidaciones</h2>

      <input
        type="text"
        className="form-control mb-3"
        placeholder="Buscar evento…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {eventos
        .filter(ev => ev.nombre.toLowerCase().includes(search.toLowerCase()))
        .map(ev => {
          const d = dataEvento(ev.id)

          if (d.cantidadPagos === 0) return null

          return (
            <div key={ev.id} className="evento-card liquidacion-card">
              <div
                className="evento-header"
                data-bs-toggle="collapse"
                data-bs-target={`#liq-${ev.id}`}
              >
                <div>
                  <h4>{ev.nombre}</h4>
                  <small>{ev.lugar}</small>
                </div>

                <div className="evento-stats">
                  <span className="stat-item money">
                    💳 ${d.totalCobrado.toLocaleString('es-AR')}
                  </span>
                  <span className="stat-item">
                    🎫 Org: ${d.totalBase.toLocaleString('es-AR')}
                  </span>
                  <span className="stat-item warning">
                    🧾 AppBar: ${d.totalComision.toLocaleString('es-AR')}
                  </span>
                  <span
                    className={`stat-item ${
                      d.pendientes > 0 ? 'pending' : 'ok'
                    }`}
                  >
                    {d.pendientes > 0
                      ? `⏳ ${d.pendientes} pendientes`
                      : '✅ Liquidado'}
                  </span>
                </div>
              </div>

              <div id={`liq-${ev.id}`} className="collapse evento-body">
                <h6 className="mt-3">Pagos incluidos</h6>

                {d.pagosEvento.map(p => (
                  <div
                    key={p.id}
                    className={`detalle-item ${
                      p.liquidado ? 'liquidado' : 'pendiente'
                    }`}
                  >
                    {p.usuarioNombre || 'Cliente'} — $
                    {p.totalCobrado?.toLocaleString('es-AR')} —{' '}
                    {p.liquidado ? '✅ Liquidado' : '⏳ Pendiente'}
                  </div>
                ))}

                <button
                  className="btn btn-primary mt-3"
                  disabled={procesando[ev.id] || d.pendientes === 0}
                  onClick={() => generarLiquidacion(ev)}
                >
                  {procesando[ev.id]
                    ? '⏳ Generando…'
                    : d.pendientes > 0
                    ? '💼 Generar liquidación'
                    : '✅ Liquidado'}
                </button>
              </div>
            </div>
          )
        })}
    </div>
  )
}

async function generarLiquidacion(ev) {
  if (procesando[ev.id]) return

  const d = dataEvento(ev.id)

  if (d.pendientes === 0) {
    Swal.fire('Nada para liquidar', 'Este evento ya está liquidado', 'info')
    return
  }

  const confirm = await Swal.fire({
    title: 'Confirmar liquidación',
    html: `
      <p><b>Evento:</b> ${ev.nombre}</p>
      <p>Organizador: <b>$${d.totalBase.toLocaleString('es-AR')}</b></p>
      <p>AppBar: <b>$${d.totalComision.toLocaleString('es-AR')}</b></p>
      <p>Total cobrado: <b>$${d.totalCobrado.toLocaleString('es-AR')}</b></p>
      <hr/>
      <p>¿Generar liquidación ahora?</p>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, liquidar',
    cancelButtonText: 'Cancelar',
  })

  if (!confirm.isConfirmed) return

  try {
    setProcesando(p => ({ ...p, [ev.id]: true }))

    const res = await fetch('/api/liquidaciones/crearLiquidaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventoId: ev.id,
        usuarioAdmin: adminUser?.email,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || 'Error al generar liquidación')
    }

    await Swal.fire(
      'Liquidación creada',
      `Liquidación #${data.liquidacionId}`,
      'success'
    )

    // 🔄 Refrescar pagos
    setPagos(p =>
      p.map(pg =>
        pg.eventoId === ev.id
          ? { ...pg, liquidado: true, liquidacionId: data.liquidacionId }
          : pg
      )
    )
  } catch (err) {
    console.error(err)
    Swal.fire('Error', err.message, 'error')
  } finally {
    setProcesando(p => ({ ...p, [ev.id]: false }))
  }
}
