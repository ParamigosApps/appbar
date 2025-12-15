// --------------------------------------------------------------
// ListaEventos.jsx — VERSIÓN FINAL (MODELO TIMESTAMP)
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import {
  escucharEventos,
  eliminarEvento,
  cancelarEvento,
} from '../../services/eventosAdmin.js'

import { db } from '../../Firebase.js'
import { collection, query, where, getDocs } from 'firebase/firestore'

/* ============================================================
   HELPERS
============================================================ */

// dd/mm/aaaa
function formatearFecha(ts) {
  if (!ts?.toDate) return '-'
  return ts.toDate().toLocaleDateString('es-AR')
}

// HH:MM
function formatearHora(ts) {
  if (!ts?.toDate) return '-'
  return ts.toDate().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Estado del evento (USANDO TIMESTAMP)
function estadoEvento(e) {
  if (e.estado === 'cancelado') {
    return { label: 'Cancelado', className: 'badge bg-danger' }
  }

  if (!e.fechaInicio || !e.fechaFin) {
    return { label: 'Sin fecha', className: 'badge bg-secondary' }
  }

  const ahora = new Date()
  const inicio = e.fechaInicio.toDate()
  const fin = e.fechaFin.toDate()

  if (ahora < inicio) {
    return { label: 'Próximo', className: 'badge bg-primary' }
  }

  if (ahora >= inicio && ahora <= fin) {
    return { label: 'En curso', className: 'badge bg-warning text-dark' }
  }

  return { label: 'Finalizado', className: 'badge bg-secondary' }
}

/* ============================================================
   COMPONENTE
============================================================ */

export default function ListaEventos({ setSeccion, setEditarId }) {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    const unsub = escucharEventos(setEventos)
    return () => unsub()
  }, [])

  async function tieneVentas(id) {
    const q = query(collection(db, 'entradas'), where('eventoId', '==', id))
    const snap = await getDocs(q)
    return !snap.empty
  }

  async function cancelar(id, nombre) {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar evento?',
      html: `
        <p>Vas a cancelar <b>${nombre}</b>.</p>
        <p>Las entradas dejarán de ser válidas.</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cancelar evento',
      cancelButtonText: 'Volver',
    })

    if (!confirm.isConfirmed) return

    const motivo =
      (
        await Swal.fire({
          title: 'Motivo de cancelación',
          input: 'text',
          inputPlaceholder: 'Opcional',
          showCancelButton: true,
        })
      ).value || ''

    await cancelarEvento(id, motivo)
    Swal.fire('Evento cancelado', 'Se actualizó correctamente.', 'success')
  }

  async function borrar(id, nombre) {
    if (await tieneVentas(id)) {
      Swal.fire({
        icon: 'error',
        title: 'No se puede eliminar',
        html:
          'Este evento tiene <b>entradas emitidas</b>.<br>' +
          'No está permitido eliminarlo.',
      })
      return
    }

    const confirm = await Swal.fire({
      title: '¿Eliminar evento?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!confirm.isConfirmed) return

    await eliminarEvento(id)
    Swal.fire('Eliminado', 'Evento eliminado correctamente.', 'success')
  }

  return (
    <div className="eventos-page">
      <div className="eventos-container">
        <h2 className="fw-bold mb-3">Eventos cargados</h2>

        {eventos.length === 0 && <p>No hay eventos aún.</p>}

        {eventos.map(e => {
          const estado = estadoEvento(e)

          return (
            <div key={e.id} className="card mb-3 shadow-sm evento-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5>
                      {e.nombre}{' '}
                      <span className={estado.className}>{estado.label}</span>
                    </h5>

                    <p className="m-0">
                      <strong>Inicio:</strong> {formatearFecha(e.fechaInicio)}{' '}
                      {formatearHora(e.fechaInicio)}
                    </p>

                    <p className="m-0">
                      <strong>Fin:</strong> {formatearFecha(e.fechaFin)}{' '}
                      {formatearHora(e.fechaFin)}
                    </p>

                    <p className="m-0">
                      <strong>Lugar:</strong> {e.lugar}
                    </p>
                  </div>

                  <div className="d-flex flex-column gap-2 text-end">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setEditarId(e.id)
                        setSeccion('editar-evento')
                      }}
                    >
                      Editar
                    </button>

                    <button
                      className="btn btn-outline-warning btn-sm"
                      onClick={() => cancelar(e.id, e.nombre)}
                    >
                      Cancelar
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => borrar(e.id, e.nombre)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {e.imagenEventoUrl && (
                  <img
                    src={e.imagenEventoUrl}
                    className="img-fluid rounded mt-3"
                    style={{ maxHeight: 180, objectFit: 'cover' }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
