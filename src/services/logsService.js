// src/services/logsService.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'

export async function logTicket({
  tipo,
  compraData,
  empleado,
  origen = 'qr-caja',
}) {
  await addDoc(collection(db, 'logsCaja'), {
    tipo,

    compraId: compraData.id,
    numeroPedido: compraData.numeroPedido,

    evento: {
      id: compraData.eventoId || null,
      nombre: compraData.nombreEvento || 'Sin evento',
    },

    empleado: {
      uid: empleado.uid || null,
      nombre: empleado.nombre || 'Caja',
      rol: empleado.rol || 'caja',
    },

    origen,
    fecha: serverTimestamp(),
  })
}
