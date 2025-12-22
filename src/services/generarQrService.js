// --------------------------------------------------------------
// src/services/generarQrService.js — FINAL DEFINITIVO (SIN CORS)
// --------------------------------------------------------------

import QRCode from 'qrcodejs2-fix'
import { storage } from '../Firebase.js'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// ======================================================
// 🔧 UTIL — base64 → Blob
// ======================================================
function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) u8arr[n] = bstr.charCodeAt(n)

  return new Blob([u8arr], { type: mime })
}

// ======================================================
// 🔧 UTIL — subir QR generado a Firebase Storage
// ======================================================
export async function subirQrGeneradoAFirebase({ qrDiv, path }) {
  if (!qrDiv) throw new Error('qrDiv inválido')

  // ⏳ Esperar a que el QR se renderice
  await new Promise(resolve => setTimeout(resolve, 300))

  let dataUrl = null

  // 🖼️ Caso IMG
  const img = qrDiv.querySelector('img')
  if (img && img.src) {
    dataUrl = img.src
  }

  // 🎨 Caso CANVAS
  if (!dataUrl) {
    const canvas = qrDiv.querySelector('canvas')
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png')
    }
  }

  if (!dataUrl) {
    throw new Error('No se pudo obtener imagen del QR')
  }

  const blob = dataURLtoBlob(dataUrl)

  const qrRef = ref(storage, path)
  await uploadBytes(qrRef, blob)

  const url = await getDownloadURL(qrRef)
  return url
}

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
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload inválido para QR')
  }

  return JSON.stringify(payload)
}
