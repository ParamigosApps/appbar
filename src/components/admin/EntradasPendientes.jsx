import { useEffect, useState } from 'react'
import {
  escucharEntradasPendientes,
  aprobarEntrada,
  rechazarEntrada,
  marcarComoPagada,
} from '../../services/entradasAdmin.js'
import Swal from 'sweetalert2'

export default function EntradasPendientes() {
  const [lista, setLista] = useState([])

  useEffect(() => {
    const unsub = escucharEntradasPendientes(setLista)
    return () => unsub()
  }, [])

  async function handleAprobar(entrada) {
    const confirm = await Swal.fire({
      title: '¿Aprobar entrada?',
      text: `Evento: ${entrada.nombreEvento}`,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
    })

    if (!confirm.isConfirmed) return

    const ok = await aprobarEntrada(entrada)
    if (ok) Swal.fire('Listo', 'Entrada aprobada', 'success')
    else Swal.fire('Error', 'No se pudo aprobar', 'error')
  }

  async function handleRechazar(id) {
    const confirm = await Swal.fire({
      title: '¿Rechazar solicitud?',
      text: 'Esta acción borrará la solicitud.',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
    })

    if (!confirm.isConfirmed) return

    const ok = await rechazarEntrada(id)
    if (ok) Swal.fire('Listo', 'Entrada rechazada', 'info')
    else Swal.fire('Error', 'No se pudo rechazar', 'error')
  }

  async function handleMarcarPagada(id) {
    const ok = await marcarComoPagada(id, true)
    if (ok) Swal.fire('Pagado', 'Entrada marcada como pagada', 'success')
    else Swal.fire('Error', 'No se pudo marcar como pagada', 'error')
  }

  return (
    <div className="container py-3">
      <h2>Entradas Pendientes</h2>

      {lista.length === 0 && (
        <p className="mt-3">No hay entradas pendientes.</p>
      )}

      {lista.map(e => (
        <div key={e.id} className="card shadow-sm mb-3">
          <div className="card-body">
            <h5>{e.nombreEvento}</h5>
            <p className="m-0">
              <strong>Usuario:</strong> {e.usuarioNombre}
            </p>
            <p className="m-0">
              <strong>Fecha:</strong> {e.fechaEvento}
            </p>
            <p className="m-0">
              <strong>Pagado:</strong> {e.pagado ? 'Sí' : 'No'}
            </p>

            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-success w-100"
                onClick={() => handleAprobar(e)}
              >
                Aprobar
              </button>
              <button
                className="btn btn-danger w-100"
                onClick={() => handleRechazar(e.id)}
              >
                Rechazar
              </button>
            </div>

            {!e.pagado && (
              <button
                className="btn btn-outline-primary mt-2 w-100"
                onClick={() => handleMarcarPagada(e.id)}
              >
                Marcar como pagada
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
