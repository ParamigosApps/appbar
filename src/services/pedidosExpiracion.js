// --------------------------------------------------------------
// src/services/pedidosExpiracion.js
// --------------------------------------------------------------
import { eliminarPedidoPendiente } from './pedidosService'
import { devolverStock } from './comprasService'
import Swal from 'sweetalert2'

// Set con IDs ya expirados
const expirados = new Set()

export function iniciarExpiracionReact(pedido, onExpire) {
  if (!pedido.creadoEn?.seconds) return

  const creado = pedido.creadoEn.seconds * 1000
  const expira = creado + 15 * 60 * 1000

  const interval = setInterval(async () => {
    const diff = expira - Date.now()

    if (diff <= 0) {
      clearInterval(interval)

      if (expirados.has(pedido.id)) return
      expirados.add(pedido.id)

      await eliminarPedidoPendiente(pedido.id)
      await devolverStock(pedido.items)

      Swal.fire({
        title: 'Pedido expirado',
        text: 'Se devolvió el stock automáticamente.',
        icon: 'warning',
        timer: 2000,
        showConfirmButton: false,
      })

      onExpire?.()
    }
  }, 1000)
}
