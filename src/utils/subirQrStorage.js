import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { storage } from '../Firebase.js'

export async function subirQrStorage(qrBase64, ticketId) {
  const clean = qrBase64.replace(/^data:image\/png;base64,/, '')

  const storageRef = ref(storage, `qrs/compras/${ticketId}.png`)

  await uploadString(storageRef, clean, 'base64', {
    contentType: 'image/png',
  })

  return await getDownloadURL(storageRef)
}
