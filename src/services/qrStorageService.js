import QRCode from 'qrcode'
import { storage } from '../Firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export async function generarYSubirQrEntrada({ payload, entradaId }) {
  if (!payload) throw new Error('Payload vacío')

  // generar imagen QR
  const dataUrl = await QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  })

  // convertir a blob
  const blob = await (await fetch(dataUrl)).blob()

  // subir a Firebase
  const qrRef = ref(storage, `qrs/entradas/${entradaId}.png`)
  await uploadBytes(qrRef, blob)

  // devolver URL pública
  return await getDownloadURL(qrRef)
}
