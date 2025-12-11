// --------------------------------------------------------------
// src/services/generarQrService.js — FINAL COMPLETO
// --------------------------------------------------------------

import QRCode from 'qrcodejs2-fix'

// ======================================================
// 🟦 GENERAR QR PARA ENTRADAS
// ======================================================
export async function generarEntradaQr({
  ticketId,
  qrContainer = null,
  downloadLink = null,
  tamaño = 220,
}) {
  try {
    if (!ticketId) throw new Error('Falta ticketId para generar el QR')

    console.log('🟦 generarEntradaQr() →', ticketId)

    const div = qrContainer || document.createElement('div')
    div.innerHTML = ''
    div.style.display = 'flex'
    div.style.justifyContent = 'center'
    div.style.alignItems = 'center'

    new QRCode(div, {
      text: ticketId.toString(),
      width: tamaño,
      height: tamaño,
      correctLevel: QRCode.CorrectLevel.M,
    })

    if (downloadLink) {
      setTimeout(() => {
        const img = div.querySelector('img')
        if (!img) return
        downloadLink.href = img.src
        downloadLink.style.display = 'block'
        downloadLink.download = `entrada-${ticketId}.png`
      }, 300)
    }

    return div
  } catch (err) {
    console.error('❌ Error en generarEntradaQr:', err)
    throw err
  }
}

// ======================================================
// 🟩 GENERAR QR PARA COMPRAS
// ======================================================
export async function generarCompraQr({
  compraId,
  numeroPedido,
  usuarioId,
  qrContainer = null,
  downloadLink = null,
  tamaño = 220,
}) {
  try {
    if (!compraId) throw new Error('Falta compraId')

    console.log('🟦 generarCompraQr() →', compraId)

    // 🔥 Datos mínimos para validar y obtener todo de Firestore
    const payload = JSON.stringify({
      id: compraId,
      pedido: numeroPedido,
      u: usuarioId,
    })

    const div = qrContainer || document.createElement('div')
    div.innerHTML = ''
    div.style.display = 'flex'
    div.style.justifyContent = 'center'
    div.style.alignItems = 'center'

    new QRCode(div, {
      text: payload,
      width: tamaño,
      height: tamaño,
      correctLevel: QRCode.CorrectLevel.M,
    })

    // 👉 Descargar QR (opcional)
    if (downloadLink) {
      setTimeout(() => {
        const img = div.querySelector('img')
        if (!img) return
        downloadLink.href = img.src
        downloadLink.style.display = 'block'
        downloadLink.download = `compra-${compraId}.png`
      }, 300)
    }

    return div
  } catch (err) {
    console.error('❌ Error en generarCompraQr:', err)
    throw err
  }
}

// ======================================================
// 🔥 Devuelve el STRING que irá al QR
// ======================================================
export function generarQrEntradaPayload(payload) {
  // Validación mínima
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload inválido para QR')
  }

  return JSON.stringify(payload)
}
