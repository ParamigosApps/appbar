import { useEffect, useState } from 'react'
import { escucharEventos, eliminarEvento } from '../../services/eventosAdmin.js'
import Swal from 'sweetalert2'

export default function ListaEventos() {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    const unsub = escucharEventos(setEventos)
    return () => unsub()
  }, [])

  async function borrar(id) {
    const confirm = await Swal.fire({
      title: '¿Eliminar evento?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!confirm.isConfirmed) return

    const ok = await eliminarEvento(id)
    if (!ok) {
      Swal.fire('Error', 'No se pudo eliminar', 'error')
    }
  }

  return (
    <div className="container py-3">
      <h2>Eventos cargados</h2>

      {eventos.length === 0 && <p>No hay eventos aún.</p>}

      {eventos.map(e => (
        <div key={e.id} className="card mb-3 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between">
              <div>
                <h5>{e.nombre}</h5>
                <p className="m-0">
                  <strong>Fecha:</strong> {e.fecha}
                </p>
                <p className="m-0">
                  <strong>Lugar:</strong> {e.lugar}
                </p>
              </div>

              <div>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => borrar(e.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>

            {e.imagen && (
              <img
                src={e.imagen}
                alt="img"
                className="img-fluid mt-2 rounded"
                style={{ maxHeight: '200px' }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
