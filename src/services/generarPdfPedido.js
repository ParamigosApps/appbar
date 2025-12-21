import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import QRCode from 'qrcode'

export async function generarPdfPedido(pedido) {
  let browser

  try {
    // 🔑 Puppeteer compatible con Vercel
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()

    // -----------------------------
    // Generar QR (mismo qrText)
    // -----------------------------
    const qrImg = pedido.qrText ? await QRCode.toDataURL(pedido.qrText) : null

    // -----------------------------
    // HTML del ticket (estructura real)
    // -----------------------------
    const html = `
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
    h1 { font-size: 20px; margin-bottom: 5px; }
    .estado {
      background: #42b14d;
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: bold;
      display: inline-block;
    }
    hr { margin: 12px 0; }
    .qr {
      text-align: center;
      margin-top: 15px;
    }
  </style>
</head>
<body>

  <h1>Pedido #${pedido.numeroPedido}</h1>

  <p><strong>Estado:</strong>
    <span class="estado">${pedido.estado.toUpperCase()}</span>
  </p>

  <p><strong>Cliente:</strong> ${pedido.usuarioNombre}</p>
  <p><strong>Lugar:</strong> ${pedido.lugar}</p>
  <p><strong>Fecha:</strong> ${pedido.fechaHumana}</p>

  <hr />

  ${pedido.items
    .map(
      p => `<p>- ${p.nombre} ×${p.enCarrito} → $${p.precio * p.enCarrito}</p>`
    )
    .join('')}

  <hr />

  <h2>Total: $${pedido.total}</h2>

  ${qrImg ? `<div class="qr"><img src="${qrImg}" width="160" /></div>` : ''}

</body>
</html>
`

    // -----------------------------
    // Render HTML → PDF
    // -----------------------------
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    })

    return pdfBuffer.toString('base64')
  } finally {
    if (browser) await browser.close()
  }
}
