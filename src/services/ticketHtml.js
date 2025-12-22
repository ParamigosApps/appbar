export function generarTicketHtml(pedido) {
  const {
    id,
    numeroPedido,
    estado,
    lugar,
    fechaHumana,
    items = [],
    total,
    ticketId,
    qrText,
  } = pedido

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 20px;
      color: #000;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 6px;
    }
    h2 {
      font-size: 18px;
      margin-top: 10px;
    }
    .estado {
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: bold;
      background: #42b14d;
      color: #fff;
      display: inline-block;
      text-transform: uppercase;
      font-size: 12px;
    }
    hr {
      margin: 12px 0;
      border: none;
      border-top: 1px solid #ccc;
    }
    .item {
      font-size: 14px;
      margin: 4px 0;
    }
    .codigo {
      font-size: 13px;
      word-break: break-all;
      margin-top: 6px;
    }
    .nota {
      font-size: 12px;
      color: #555;
      margin-top: 12px;
    }
  </style>
</head>
<body>

  <h1>Pedido #${numeroPedido}</h1>

  <p>
    <strong>Estado:</strong>
    <span class="estado">${estado}</span>
  </p>

  <p><strong>Lugar:</strong> ${lugar}</p>
  <p><strong>Fecha:</strong> ${fechaHumana}</p>

  <hr>

  ${
    items.length > 0
      ? items
          .map(
            i =>
              `<div class="item">- ${i.nombre} ×${i.enCarrito} → $${
                i.precio * i.enCarrito
              }</div>`
          )
          .join('')
      : '<p class="item">Sin items</p>'
  }

  <hr>

  <h2>Total: $${total}</h2>

  <hr>

  <!-- BLOQUE DE IDENTIFICACIÓN (SIN LINKS) -->
  <div class="codigo">
    <strong>Código del pedido:</strong><br/>
    ${numeroPedido || ticketId || id}
  </div>

  <div class="codigo">
    <strong>ID interno:</strong><br/>
    ${id}
  </div>

  ${
    qrText
      ? `
  <div class="codigo">
    <strong>Código QR (texto):</strong><br/>
    ${qrText}
  </div>
  `
      : ''
  }

  <p class="nota">
    Este comprobante es válido únicamente para este pedido.
    No es transferible ni reutilizable.
  </p>

</body>
</html>
`
}
