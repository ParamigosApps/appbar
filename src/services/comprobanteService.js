import Swal from 'sweetalert2'

// ======================================================
// COMPROBANTE — TICKET PARA RETIRAR EN BARRA (FINAL)
// ======================================================
export async function mostrarComprobanteCaja(compra) {
  const {
    numeroPedido,
    usuarioNombre,
    lugar,
    items = [],
    total,
    creadoEn,
    nombreEvento,
    fechaEvento,
  } = compra

  const fechaHumana = creadoEn?.toDate
    ? creadoEn.toDate().toLocaleString('es-AR')
    : new Date().toLocaleString('es-AR')

  const res = await Swal.fire({
    title: '🎫 Ticket de Retiro',
    width: '420px',
    html: `
        <div id="ticket-print" style="
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

        <p><strong>Cliente:</strong> ${usuarioNombre}</p>
        <p><strong>Lugar:</strong> ${lugar}</p>

        <p style="
          margin-top:6px;
          padding:6px;
          background:#dcfce7;
          color:#166534;
          font-weight:bold;
          text-align:center;
          border-radius:6px;
        ">
          PEDIDO PAGO
        </p>

        <p style="
          margin-top:6px;
          padding:6px;
          background:#fef3c7;
          color:#92400e;
          font-weight:bold;
          text-align:center;
          border-radius:6px;
        ">
          Presentar este ticket en la barra para retirar tu pedido.
        </p>

        <hr>

        ${items
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

<p style="
  margin-top:10px;
  font-size:12px;
  text-align:center;
  color:#374151;
  font-weight:600;
">
  Ticket válido únicamente para el evento: 

  <span style="font-weight:800">
    ${compra.nombreEvento || 'Nombre no disponible'}
  </span><br>
  <span style="font-weight:800">
     ${compra.fechaEvento || 'Fecha no disponible'}
  </span>

  <span style="font-size:11px;color:#6b7280">
    ${
      compra.fechaEvento
        ? new Date(
            compra.fechaEvento.seconds
              ? compra.fechaEvento.seconds * 1000
              : compra.fechaEvento
          ).toLocaleDateString('es-AR')
        : ''
    }
  </span>
</p>




      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Imprimir',
    cancelButtonText: 'Cerrar',
    allowOutsideClick: false,
    allowEscapeKey: false,
    buttonsStyling: false,
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-alt',
    },
    didOpen: () => {
      const style = document.createElement('style')
      style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        .swal2-popup, .swal2-popup * {
          visibility: visible;
        }
        .swal2-popup {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
      }
    `
      document.head.appendChild(style)
    },
  })
  if (!res.isConfirmed) {
    // ❌ El usuario NO imprimió
    return { impreso: false }
  }

  const content = document.getElementById('ticket-print')
  if (!content) {
    return { impreso: false }
  }

  // 🖨️ Abrir ventana de impresión
  const printWindow = window.open('', '', 'width=400,height=600')
  if (!printWindow) {
    return { impreso: false }
  }

  printWindow.document.write(`
  <html>
    <head>
      <title>Ticket #${numeroPedido}</title>
      <style>
        body {
          font-family: monospace;
          margin: 0;
          padding: 10px;
        }
        hr {
          border: none;
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      ${content.innerHTML}
    </body>
  </html>
`)

  printWindow.document.close()
  printWindow.focus()

  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)

  // ✅ AHORA SÍ: se considera impreso
  return { impreso: true }
}
