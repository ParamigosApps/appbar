import QRCode from 'qrcode'

export async function generarQrBase64(texto) {
  return await QRCode.toDataURL(texto, {
    margin: 2,
    width: 300,
  })
}
