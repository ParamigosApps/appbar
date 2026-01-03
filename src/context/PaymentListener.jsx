import { useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../Firebase'
import { toast } from 'react-toastify'

export function PaymentListener({ pagoId }) {
  useEffect(() => {
    if (!pagoId) return

    const ref = doc(db, 'pagos', pagoId)

    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return

      const pago = snap.data()

      if (pago.estado === 'aprobado') {
        toast.success('✅ Pago aprobado. Tus entradas ya están disponibles')
        localStorage.removeItem('pagoIdEnProceso')
      }

      if (pago.estado === 'rechazado') {
        toast.error('❌ El pago fue rechazado')
        localStorage.removeItem('pagoIdEnProceso')
      }
    })

    return () => unsub()
  }, [pagoId])

  return null
}
