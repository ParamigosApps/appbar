import { useEffect, useState } from 'react'
import {
  escucharComprasPendientes,
  aprobarCompra,
  rechazarCompra,
  marcarCompraPagada,
} from '../../services/pedidosAdmin.js'
import Swal from 'sweetalert2'

export default function PedidosPendientes() {
  const [lista, setLista] = useState([])

  useEffect(() => {
    const unsub = escucharComprasPendientes(setLista)
    return () => unsub()
  }, [])

  async function handleAprobar(compra) {
    const confirm = await Swal.fire({
      title: '¿Aprobar compra?',
      text: `Total: $${compra.total}`,
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
    })

    if (!confirm.isConfirmed) return

    const ok = await aprobarCompra(compra)
    if (ok) Swal.fire('Listo', 'Compra aprobada', 'success')
    else Swal.fire('Error', 'No se pudo aprobar', 'error')
  }

  async function handleRechazar(id) {
    const confirm = await Swal.fire({
      title: '¿Rechazar compra?',
      text: 'Esta acción borrará la compra pendiente',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
    })

    if (!confirm.isConfirmed) return

    const ok = await rechazarCompra(id)
    if (ok) Swal.fire('Listo', 'Compra rechazada', 'info')
    else Swal.fire('Error', 'No se pudo rechazar', 'error')
  }

  async function handleMarcarPagada(id) {
    const ok = await marcarCompraPagada(id, true)
    if (ok) Swal.fire('Pagado', 'La compra fue marcada como pagada', 'success')
    else Swal.fire('Error', 'No se pudo marcar como pagada', 'error')
  }

  return (
    <div className="container py-3">
      <h2>Compras Pendientes</h2>

      {lista.length === 0 && <p>No hay compras pendientes.</p>}

      {lista.map(c => (
        <div key={c.id} className="card mb-3 shadow-sm">
          <div className="card-body">
            <h5>Compra #{c.id}</h5>
            <p className="m-0">
              <strong>Usuario:</strong> {c.usuarioId}
            </p>
            <p className="m-0">
              <strong>Total:</strong> ${c.total}
            </p>
            <p className="m-0">
              <strong>Pagado:</strong> {c.pagado ? 'Sí' : 'No'}
            </p>

            <h6 className="mt-3">Productos:</h6>
            <ul>
              {c.productos?.map((p, i) => (
                <li key={i}>
                  {p.nombre} - x{p.cantidad} - ${p.precio}
                </li>
              ))}
            </ul>

            <div className="d-flex gap-2 mt-3">
              <button
                className="btn swal-btn-confirm w-100"
                onClick={() => handleAprobar(c)}
              >
                Aprobar
              </button>
              <button
                className="btn btn-danger w-100"
                onClick={() => handleRechazar(c.id)}
              >
                Rechazar
              </button>
            </div>

            {!c.pagado && (
              <button
                className="btn btn-outline-primary w-100 mt-2"
                onClick={() => handleMarcarPagada(c.id)}
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
