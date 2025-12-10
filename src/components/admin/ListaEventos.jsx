// --------------------------------------------------------------
// ListaEventos.jsx — con Tags de Estado, Editar y Cancelar
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import {
  escucharEventos,
  eliminarEvento,
  cancelarEvento,
} from '../../services/eventosAdmin.js'

import { formatearSoloFecha } from '../../utils/utils.js'
import { db } from '../../Firebase.js'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function ListaEventos({ setSeccion, setEditarId }) {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    const unsub = escucharEventos(setEventos)
    return () => unsub()
  }, [])
  function obtenerHoras(horario) {
    if (!horario) return { desde: '-', hasta: '-' }

    const matchDesde = horario.match(/Desde\s(\d{2}:\d{2})/)
    const matchHasta = horario.match(/hasta\s(\d{2}:\d{2})/i)

    return {
      desde: matchDesde ? matchDesde[1] : '-',
      hasta: matchHasta ? matchHasta[1] : '-',
    }
  }

  // --------------------------------------------------------------
  // 1) CHEQUEAR SI EL EVENTO TIENE ENTRADAS VENDIDAS
  // --------------------------------------------------------------
  async function tieneVentas(id) {
    const q = query(collection(db, 'entradas'), where('eventoId', '==', id))
    const snap = await getDocs(q)
    return !snap.empty
  }

  // --------------------------------------------------------------
  // 2) CANCELAR EVENTO
  // --------------------------------------------------------------
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

  // --------------------------------------------------------------
  // 3) BORRAR EVENTO (solo sin ventas)
  // --------------------------------------------------------------
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

  // --------------------------------------------------------------
  // 4) DETERMINAR ESTADO DEL EVENTO + TAG
  // --------------------------------------------------------------
  function estadoEvento(e) {
    if (e.estado === 'cancelado')
      return { label: 'Cancelado', className: 'badge bg-danger' }

    const hoy = new Date()
    const hoyISO = hoy.toISOString().slice(0, 10) // yyyy-mm-dd

    if (!e.fecha) return { label: 'Sin fecha', className: 'badge bg-secondary' }

    const eventDate = e.fecha
    const desde = e.horario?.match(/(\d{2}:\d{2})/)?.[1] || '00:00'
    const hasta = e.horario?.match(/(\d{2}:\d{2})$/)?.[0] || '23:59'

    const [hHasta, mHasta] = hasta.split(':').map(Number)

    const fechaEvento = new Date(`${eventDate}T00:00:00`)
    const fechaHoy = new Date(`${hoyISO}T00:00:00`)

    // FINALIZADO
    if (
      fechaEvento < fechaHoy &&
      !(eventDate < hoyISO && hHasta > hoy.getHours())
    )
      return { label: 'Finalizado', className: 'badge bg-secondary' }

    // EVENTO NOCTURNO EN CURSO (pasa de día)
    if (eventDate < hoyISO && hHasta > hoy.getHours()) {
      return { label: 'En curso', className: 'badge bg-warning text-dark' }
    }

    // HOY
    if (eventDate === hoyISO)
      return { label: 'Hoy', className: 'badge bg-success' }

    // PRÓXIMO
    if (eventDate > hoyISO)
      return { label: 'Próximo', className: 'badge bg-primary' }

    return { label: 'Evento', className: 'badge bg-secondary' }
  }

  // --------------------------------------------------------------
  // 5) UI
  // --------------------------------------------------------------
  return (
    <div className="container py-3">
      <h2 className="fw-bold">Eventos cargados</h2>

      {eventos.length === 0 && <p>No hay eventos aún.</p>}

      {eventos.map(e => {
        const estado = estadoEvento(e)
        const horas = obtenerHoras(e.horario)

        return (
          <div key={e.id} className="card mb-3 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5>
                    {e.nombre}{' '}
                    <span className={estado.className}>{estado.label}</span>
                  </h5>

                  <p className="m-0">
                    <strong>Fecha:</strong> {formatearSoloFecha(e.fecha)}
                  </p>
                  <p className="m-0">
                    <strong>Inicio:</strong> {horas.desde} <strong>Fin:</strong>{' '}
                    {horas.hasta}
                  </p>
                  <p className="m-0">
                    <strong>Lugar:</strong> {e.lugar}
                  </p>
                </div>

                {/* ACCIONES */}
                <div className="d-flex flex-column gap-2">
                  <button
                    className="btn btn-outline-primary"
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
                  style={{ maxHeight: '180px', objectFit: 'cover' }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
