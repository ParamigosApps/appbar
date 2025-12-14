import Swal from 'sweetalert2'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { generarCompraQr } from './generarQrService.js'

// ======================================================
// COMPROBANTE — TICKET PARA RETIRAR EN BARRA
// ======================================================
export async function mostrarComprobanteCaja(compra) {
  const {
    numeroPedido,
    usuarioNombre,
    lugar,
    carrito,
    items,
    total,
    ticketId,
    creadoEn,
  } = compra

  const lista = items || carrito || []

  const fechaHumana = creadoEn?.toDate
    ? creadoEn.toDate().toLocaleString()
    : new Date().toLocaleString()

  await Swal.fire({
    title: '🎫 Ticket de Retiro',
    width: '420px',
    html: `
      <div id="ticketGenerado" style="
        font-size:14px;
        font-family: monospace;
        border:2px dashed #000;
        padding:12px;
        background:#ffffff;
      ">
        <div style="text-align:center;margin-bottom:8px;">
          <strong style="font-size:18px">PEDIDO #${numeroPedido}</strong><br>
          <span style="font-size:12px">${fechaHumana}</span>
        </div>

        <hr>

        <div style="margin-bottom:4px">
          <strong>Cliente:</strong> ${usuarioNombre}
        </div>

        <div style="margin-bottom:4px">
          <strong>Lugar:</strong> ${lugar}
        </div>

        <div style="
          display:flex;
          align-items:center;
          gap:6px;
          margin-top:4px;
        ">
          <strong>Estado:</strong>
          <span style="
            padding:4px 10px;
            background:#16a34a;
            color:#ffffff;
            font-weight:bold;
            border-radius:999px;
            font-size:13px;
          ">
            PEDIDO PAGO
          </span>
        </div>


        <p style="
          margin-top:6px;
          padding:6px;
          background:#fef3c7;
          color:#92400e;
          font-weight:bold;
          text-align:center;
          border-radius:6px;
        ">
          Presentar ticket en la barra para retirar su pedido.
        </p>


        <hr>

        ${lista
          .map(
            p => `
            <div style="display:flex;justify-content:space-between">
              <span>${p.nombre} ×${p.enCarrito}</span>
              <span>$${p.precio * p.enCarrito}</span>
            </div>
          `
          )
          .join('')}

        <hr>

        <div style="display:flex;justify-content:space-between;font-size:18px">
          <strong>TOTAL</strong>
          <strong>$${total}</strong>
        </div>

        <div id="qrCompraContainer" style="margin-top:12px;display:flex;justify-content:center"></div>
      </div>

      <div style="margin-top:15px">
        <button id="btnPdf" class="btn btn-dark w-100">Descargar PDF</button>
      </div>
    `,
    didOpen: async () => {
      await generarCompraQr({
        ticketId,
        contenido: ticketId,
        qrContainer: document.getElementById('qrCompraContainer'),
        tamaño: 160,
      })

      document.getElementById('btnPdf').onclick = async () => {
        const canvas = await html2canvas(
          document.getElementById('ticketGenerado'),
          { scale: 2 }
        )
        const pdf = new jsPDF()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, 180, 0)
        pdf.save(`ticket-pedido-${numeroPedido}.pdf`)
      }
    },
    confirmButtonText: 'Cerrar',
    buttonsStyling: false,
  })
}
