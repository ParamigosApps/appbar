// --------------------------------------------------------------
// src/components/qr/ModalQrCompra.jsx — FINAL DEFINITIVO
// --------------------------------------------------------------
import Swal from 'sweetalert2'
import { auth } from '../../Firebase.js'
import whatsappIcon from '../../assets/img/whatsapp.png'
import { formatearFecha } from '../../utils/utils.js'

export async function mostrarQrCompraReact(pedido, onClose) {
  try {
    const {
      carrito = [],
      total = 0,
      ticketId,
      numeroPedido,
      estado = 'pendiente',
      lugar = 'Tienda',
      fechaHumana = formatearFecha(new Date()),
      usuarioNombre = auth.currentUser?.displayName || 'Usuario',
      qrUrl,
    } = pedido

    const estadosPretty = {
      pagado: '🟢 PAGADO',
      pendiente: '🟡 PENDIENTE',
      retirado: '⚪ RETIRADO',
    }

    await Swal.fire({
      title: '🧾 Ticket de Compra',
      width: '430px',
      confirmButtonText: 'Cerrar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn swal-btn-confirm' },

      html: `
        <div style="text-align:left;font-size:15px;line-height:1.4;padding:10px">

          <p style="margin-bottom:6px">
            <strong style="font-size:18px">
              Pedido #${numeroPedido ?? ticketId}
            </strong>
          </p>

          <p><strong>Estado:</strong> ${estadosPretty[estado]}</p>
          <p><strong>Cliente:</strong> ${usuarioNombre}</p>
          <p><strong>Lugar:</strong> ${lugar}</p>
          <p><strong>Fecha:</strong> ${fechaHumana}</p>

          <hr style="margin:10px 0">

          <p><strong>Detalle:</strong></p>
          ${carrito
            .map(
              p => `
              <p style="margin:0">
                - ${p.nombre} ×${p.enCarrito} → $${p.precio * p.enCarrito}
              </p>
            `
            )
            .join('')}

          <hr style="margin:10px 0">

          <p style="font-size:18px">
            <strong>Total: $${total}</strong>
          </p>

          ${
            estado !== 'retirado' && qrUrl
              ? `
                <div style="text-align:center;margin-top:14px">
                  <img
                    src="${qrUrl}"
                    alt="QR del pedido"
                    style="width:200px;height:auto;display:block;margin:auto"
                  />
                  <p style="font-size:13px;color:#555;margin-top:6px">
                    Presentá este QR para retirar tu pedido
                  </p>
                </div>
              `
              : `
                <p style="text-align:center;color:#999;margin-top:12px">
                  QR no disponible
                </p>
              `
          }

          ${
            estado !== 'retirado'
              ? `
                <div style="margin-top:16px;text-align:center">
                  <button id="btnWsp" class="btn-ticket btn-wsp mx-auto d-block">
                    <img src="${whatsappIcon}" alt="WhatsApp" />
                    Enviar por WhatsApp
                  </button>
                </div>
              `
              : ''
          }

        </div>
      `,

      didOpen: () => {
        document.getElementById('btnWsp')?.addEventListener('click', () => {
          let msg = `🧾 *Ticket de compra*\\n`
          msg += `Pedido #${numeroPedido ?? ticketId}\\n`
          msg += `Estado: ${estado.toUpperCase()}\\n`
          msg += `Total: $${total}\\n`
          msg += `Fecha: ${fechaHumana}\\n`

          window.open(
            `https://wa.me/?text=${encodeURIComponent(msg)}`,
            '_blank'
          )
        })
      },

      willClose: () => onClose && onClose(),
    })
  } catch (err) {
    console.error('❌ Error Ticket React:', err)
    Swal.fire('Error', 'No se pudo mostrar el ticket.', 'error')
  }
}
