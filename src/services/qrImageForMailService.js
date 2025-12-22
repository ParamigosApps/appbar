import QRCode from 'qrcode'

export async function generarQrImagen(payload) {
  if (!payload) throw new Error('Payload vacío')

  return await QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
}
