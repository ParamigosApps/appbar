// --------------------------------------------------------------
// src/components/qr/ModalQrCompra.jsx — FINAL
// --------------------------------------------------------------
import Swal from 'sweetalert2'

// --------------------------------------------------------------
// 🔵 mostrarQrCompraReact — Ticket igual al original + sin QR si retirado
// --------------------------------------------------------------

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { formatearFecha } from '../../utils/utils.js'
import { generarCompraQr } from '../../services/generarQrService.js'

export async function mostrarQrCompraReact(pedido, onClose) {
  try {
    console.log('🧾 mostrarQrCompraReact() →', pedido)

    const {
      carrito = [],
      total = 0,
      ticketId,
      numeroPedido,
      estado = 'pendiente',
      lugar = 'Tienda',
      fechaHumana = formatearFecha(new Date()),
      usuarioNombre = 'Usuario',
    } = pedido

    // -------------------- ESTILOS DE ESTADO (IGUAL QUE EL ORIGINAL) --------------------
    const estadosPretty = {
      pagado: `<span style="
        background:#42b14d;
        color:#fff;
        padding:3px 8px;
        border-radius:6px;
        font-weight:700;
        font-size:13px;">
        PAGADO
      </span>`,

      pendiente: `<span style="
        background:#f7d774;
        color:#000;
        padding:3px 8px;
        border-radius:6px;
        font-weight:700;
        font-size:13px;">
        PENDIENTE
      </span>`,

      retirado: `<span style="
        background:#bbb;
        color:#000;
        padding:3px 8px;
        border-radius:6px;
        font-weight:700;
        font-size:13px;">
        RETIRADO
      </span>`,
    }

    const estadoHTML = estadosPretty[estado] || estado.toUpperCase()

    // -------------------- ALERTA SWEETALERT2 --------------------
    await Swal.fire({
      title: '🧾 Ticket de Compra',
      width: '430px',
      confirmButtonText: 'Cerrar',
      showConfirmButton: true,
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-dark' },

      html: `
        <div id="ticketGenerado"
             style="text-align:left; font-size:15px; line-height:1.35; padding:10px;">

          <p style="margin:0 0 8px 0;">
            <strong style="font-size:18px;">
              Pedido #${numeroPedido ?? ticketId}
            </strong>
          </p>

          <p style="margin:0 0 8px 0;"><strong>Estado:</strong> ${estadoHTML}</p>

          <hr style="margin:10px 0;">

          <p><strong>Cliente:</strong> ${usuarioNombre}</p>
          <p><strong>Lugar:</strong> ${lugar}</p>
          <p><strong>Fecha:</strong> ${fechaHumana}</p>

          <hr style="margin:10px 0;">

          <p><strong>Su pedido:</strong></p>

          <div style="margin-left:10px; margin-bottom:6px;">
            ${carrito
              .map(
                p => `
              <p style="margin:0 0 4px 0;">
                - ${p.nombre} ×${p.enCarrito} → $${p.precio * p.enCarrito}
              </p>
            `
              )
              .join('')}
          </div>

          <hr style="margin:10px 0;">

          <p style="font-size:19px;">
            <strong>Total: $${total}</strong>
          </p>

          <div id="qrCompraContainer"
               style="display:flex; justify-content:center; margin-top:12px;"></div>
        </div>

        ${
          estado === 'retirado'
            ? ''
            : `
<div class="botones-ticket">
  <button id="btnPdf" class="btn-ticket btn-pdf">
    <img
      src="https://cdn-icons-png.flaticon.com/512/337/337946.png"
      alt="PDF"
    />
    Descargar PDF
  </button>

  <button id="btnWsp" class="btn-ticket btn-wsp">
    <img
      src="../src/assets/img/whatsapp.png"
      alt="WhatsApp"
    />
    Enviar por WhatsApp
  </button>
</div>


        `
        }
      `,

      // -------------------- DID OPEN --------------------
      didOpen: async () => {
        const ticket = document.getElementById('ticketGenerado')

        // 👉 No generar QR si está retirado
        if (estado !== 'retirado') {
          const cont = document.getElementById('qrCompraContainer')
          if (cont) {
            await generarCompraQr({
              compraId: ticketId,
              contenido: `Compra:${ticketId}`,
              qrContainer: cont,
              tamaño: 200,
            })
            console.log('✅ QR generado')
          }
        } else {
          console.log('🎫 Pedido RETIRADO → no se genera QR')
        }

        // -------------------- 📄 Descargar PDF --------------------
        if (estado !== 'retirado') {
          document
            .getElementById('btnPdf')
            ?.addEventListener('click', async () => {
              const canvas = await html2canvas(ticket)
              const img = canvas.toDataURL('image/png')
              const pdf = new jsPDF()
              pdf.addImage(img, 'PNG', 10, 10, 190, 0)
              pdf.save(`ticket-${numeroPedido ?? ticketId}.pdf`)
            })

          // -------------------- 📲 WhatsApp --------------------
          document.getElementById('btnWsp')?.addEventListener('click', () => {
            let msg = `🧾 *Ticket de compra*\n`
            msg += `Pedido #${numeroPedido ?? ticketId}\n`
            msg += `Estado: ${estado.toUpperCase()}\n`
            msg += `Total: $${total}\n`
            msg += `Fecha: ${fechaHumana}\n\n`
            msg += `¡Gracias por tu compra!`

            const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
            window.open(url, '_blank')
          })
        }
      },

      willClose: () => onClose && onClose(),
    })
  } catch (err) {
    console.error('❌ Error Ticket React:', err)
    Swal.fire('Error', 'No se pudo generar el ticket.', 'error')
  }
}
