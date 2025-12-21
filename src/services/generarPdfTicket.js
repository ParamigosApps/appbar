import puppeteer from 'puppeteer'
import { generarTicketHtml } from './ticketHtml.js'

export async function generarPdfTicket(pedido) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  const html = generarTicketHtml(pedido)

  await page.setContent(html, { waitUntil: 'networkidle0' })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
  })

  await browser.close()

  return pdf.toString('base64')
}
