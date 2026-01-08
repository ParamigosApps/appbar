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

    const badgeEstado = estado => {
      const map = {
        pendiente: { text: 'Pendiente', bg: '#f59e0b', color: '#111' },
        pagado: { text: 'Pagado', bg: '#16a34a', color: '#fff' },
        retirado: { text: 'Retirado', bg: '#2563eb', color: '#fff' },
        expirado: { text: 'Expirado', bg: '#dc2626', color: '#fff' },
      }

      const e = map[estado] || {
        text: estado,
        bg: '#6b7280',
        color: '#fff',
      }

      return `
    <span style="
      display:inline-block;
      padding:4px 10px;
      border-radius:999px;
      font-size:13px;
      font-weight:700;
      background:${e.bg};
      color:${e.color};
    ">
      ${e.text}
    </span>
  `
    }
    const codigoValidacion = ticketId || numeroPedido

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

      <p>
        <strong>Estado:</strong>
        ${badgeEstado(estado.toUpperCase())}
      </p>

          <p><strong>Cliente:</strong> ${usuarioNombre}</p>
          <p><strong>Lugar:</strong> ${lugar}</p>

          ${
            estado !== 'retirado'
              ? `<p><strong>Fecha:</strong> ${fechaHumana}</p>`
              : `<p><strong>Fecha de retiro:</strong> ${fechaHumana}</p>`
          }

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

                <p style="font-size:12px;color:#666">
                ID código ingreso manual: 
                
                <span style="
                  font-size:14px;
                  font-weight:700;
                  letter-spacing:0.7px;
                  display:inline-block;
                  margin-top:4px;
                ">
                  ${codigoValidacion}
                </span>
              </p>
                </div>


              `
              : `
            <p style="text-align:center;color:#999;margin:48px 0;font-size:16px;font-weight:700;">
              QR ya utilizado
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
          const detalleProductos = carrito
            .map(p => `• ${p.nombre} ×${p.enCarrito}`)
            .join('\n')

          const codigoValidacion = ticketId || numeroPedido

          const msg =
            `- *Ticket de compra*\n` +
            `Pedido #${numeroPedido ?? codigoValidacion}\n` +
            `Estado: ${estado.toUpperCase()}\n` +
            `Fecha: ${fechaHumana}\n` +
            `*Detalle del pedido:*\n` +
            `${detalleProductos}\n` +
            `- *Total:* $${total}\n\n` +
            (qrUrl
              ? `*Link al QR para retirar el pedido:*\n${qrUrl}\n\n`
              : '') +
            `Si el QR no escanea, informá este código al personal.\n` +
            `- *Código de validación:* ${codigoValidacion}`
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
