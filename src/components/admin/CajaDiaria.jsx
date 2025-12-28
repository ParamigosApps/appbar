// --------------------------------------------------------------
// CierreEvento.jsx — CIERRE DE EVENTO (PROFESIONAL)
// --------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { db } from '../../Firebase'
import { useAuth } from '../../context/AuthContext'

// --------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------
function formatearFecha(ts) {
  const d = ts?.toDate?.() ?? (ts ? new Date(ts) : null)
  if (!d) return '-'
  return d.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  })
}

function calcularMetricas(compras = []) {
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
// COMPONENTE
// --------------------------------------------------------------
export default function CierreEvento() {
  const { eventoId } = useParams()
  const navigate = useNavigate()
  const { empleado } = useAuth()
  const nivel = Number(empleado?.nivel || 0)

  if (nivel < 3) {
    return (
      <div className="alert alert-danger">
        ⛔ No tenés permisos para cerrar eventos.
      </div>
    )
  }

  const [evento, setEvento] = useState(null)
  const [compras, setCompras] = useState([])
  const [cierreExistente, setCierreExistente] = useState(null)
  const [cargando, setCargando] = useState(true)

  // ------------------------------------------------------------
  // CARGA DATOS
  // ------------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      setCargando(true)

      const eventoSnap = await getDoc(doc(db, 'eventos', eventoId))
      if (!eventoSnap.exists()) {
        alert('Evento no encontrado')
        navigate(-1)
        return
      }

      setEvento({ id: eventoSnap.id, ...eventoSnap.data() })

      const cierreSnap = await getDoc(doc(db, 'cierres_evento', eventoId))
      if (cierreSnap.exists()) {
        setCierreExistente(cierreSnap.data())
      }

      const q = query(
        collection(db, 'compras'),
        where('eventoId', '==', eventoId)
      )
      const snap = await getDocs(q)
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })))

      setCargando(false)
    }

    cargar()
  }, [eventoId])

  // ------------------------------------------------------------
  // MÉTRICAS
  // ------------------------------------------------------------
  const metricas = useMemo(() => calcularMetricas(compras), [compras])

  // ------------------------------------------------------------
  // CERRAR EVENTO
  // ------------------------------------------------------------
  async function cerrarEvento() {
    if (!confirm('¿Confirmás el cierre definitivo del evento?')) return

    const ref = doc(db, 'cierres_evento', eventoId)

    await setDoc(ref, {
      eventoId,
      nombreEvento: evento.nombre,
      fechaEvento: evento.fechaInicio || null,
      cerrado: true,

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
        nivel,
      },

      cerradoEn: serverTimestamp(),
    })

    alert('✅ Evento cerrado correctamente')
    navigate('/admin/compras')
  }

  // ------------------------------------------------------------
  // EXPORTAR CSV
  // ------------------------------------------------------------
  function exportarCSV() {
    let csv = 'pedido,cliente,estado,total,fecha\n'
    compras.forEach(c => {
      csv += `${c.numeroPedido},${c.usuarioNombre},${c.estado},${
        c.total
      },${formatearFecha(c.creadoEn)}\n`
    })

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cierre_evento_${evento.nombre}.csv`
    a.click()
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  if (cargando) return <p>Cargando cierre de evento...</p>

  return (
    <div className="container">
      <h4 className="fw-bold mb-3">📦 Cierre de Evento</h4>

      <div className="mb-3">
        <strong>{evento.nombre}</strong>{' '}
        <span className="text-muted">
          ({formatearFecha(evento.fechaInicio)})
        </span>
      </div>

      {cierreExistente && (
        <div className="alert alert-warning">
          ⚠️ Este evento ya fue cerrado el{' '}
          {formatearFecha(cierreExistente.cerradoEn)} por{' '}
          {cierreExistente.cerradoPor?.nombre}
        </div>
      )}

      <div className="row g-2 mb-3">
        <Metric title="Pedidos" value={metricas.pedidos} />
        <Metric title="Total" value={`$${metricas.total}`} />
        <Metric title="Pendiente" value={`$${metricas.pendiente}`} />
        <Metric title="Pagado" value={`$${metricas.pagado}`} />
        <Metric title="Retirado" value={`$${metricas.retirado}`} />
      </div>

      <div className="d-flex gap-2">
        <button className="btn btn-outline-success" onClick={exportarCSV}>
          Exportar CSV
        </button>

        {!cierreExistente && (
          <button className="btn btn-danger" onClick={cerrarEvento}>
            🔒 Cerrar evento definitivamente
          </button>
        )}

        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------
function Metric({ title, value }) {
  return (
    <div className="col-6 col-md-2">
      <div className="p-2 bg-light rounded text-center">
        <div style={{ fontSize: 12 }}>{title}</div>
        <div className="fw-bold">{value}</div>
      </div>
    </div>
  )
}
