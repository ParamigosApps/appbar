import { useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../Firebase'

export default function PaymentListener({ pagoId }) {
  useEffect(() => {
    if (!pagoId) return

    const ref = doc(db, 'pagos', pagoId)

    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return

      const pago = snap.data()

      if (pago.estado === 'aprobado') {
        localStorage.removeItem('pagoIdEnProceso')
      }

      if (pago.estado === 'rechazado') {
        localStorage.removeItem('pagoIdEnProceso')
      }
    })

    return () => unsub()
  }, [pagoId])

  return null
}
