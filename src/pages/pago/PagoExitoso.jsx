import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../Firebase'
import BasePagoLayout from './BasePagoLayout'
import '../../styles/pago.css'

export default function PagoExitoso() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const pagoId = params.get('external_reference')

  const [estado, setEstado] = useState('verificando')

  useEffect(() => {
    if (!pagoId) return

    const check = async () => {
      const ref = doc(db, 'pagos', pagoId)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        const pago = snap.data()
        if (pago.estado === 'aprobado') {
          setEstado('ok')
        }
      }
    }

    const interval = setInterval(check, 2000)
    return () => clearInterval(interval)
  }, [pagoId])

  if (estado === 'verificando') {
    return (
      <BasePagoLayout
        icon="⏳"
        title="Confirmando pago"
        description="Estamos verificando tu pago con Mercado Pago."
      />
    )
  }

  return (
    <BasePagoLayout
      icon="✅"
      title="Pago confirmado"
      description="Tu compra fue realizada con éxito."
    >
      <button className="btn primary" onClick={() => navigate('/historial')}>
        Ver mis entradas
      </button>
      <button className="btn secondary" onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </BasePagoLayout>
  )
}
