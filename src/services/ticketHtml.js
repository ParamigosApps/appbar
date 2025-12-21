export function generarTicketHtml(pedido) {
  const { numeroPedido, estado, lugar, fechaHumana, items, total } = pedido

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 20px;
    }
    h1 { font-size: 20px; }
    .estado {
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: bold;
      background: #42b14d;
      color: white;
      display: inline-block;
    }
    hr { margin: 12px 0; }
  </style>
</head>
<body>
  <h1>Pedido #${numeroPedido}</h1>
  <p><strong>Estado:</strong> <span class="estado">${estado}</span></p>
  <p><strong>Lugar:</strong> ${lugar}</p>
  <p><strong>Fecha:</strong> ${fechaHumana}</p>

  <hr>

  ${items
    .map(
      i => `<p>- ${i.nombre} ×${i.enCarrito} → $${i.precio * i.enCarrito}</p>`
    )
    .join('')}

  <hr>

  <h2>Total: $${total}</h2>
</body>
</html>
`
}
