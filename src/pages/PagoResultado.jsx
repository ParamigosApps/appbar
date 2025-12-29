import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'

import BasePagoLayout from './pago/BasePagoLayout'

export default function PagoResultado() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const pagoId = params.get('external_reference')

  const [estado, setEstado] = useState('verificando')
  const [intentos, setIntentos] = useState(0)

  // --------------------------------------------------
  // VERIFICAR PAGO
  // --------------------------------------------------
  useEffect(() => {
    if (!pagoId) {
      setEstado('rechazado')
      return
    }

    const check = async () => {
      const ref = doc(db, 'pagos', pagoId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return

      const pago = snap.data()

      if (pago.estado === 'aprobado') {
        localStorage.setItem('avisoPostPago', 'aprobado')
        setEstado('aprobado')
        return
      }

      if (['fallido', 'monto_invalido'].includes(pago.estado)) {
        localStorage.setItem('avisoPostPago', 'rechazado')
        setEstado('rechazado')
        return
      }

      setIntentos(i => i + 1)
    }

    const interval = setInterval(check, 2000)
    return () => clearInterval(interval)
  }, [pagoId])

  // --------------------------------------------------
  // TIMEOUT → PENDIENTE
  // --------------------------------------------------
  useEffect(() => {
    if (intentos >= 10 && estado === 'verificando') {
      localStorage.setItem('avisoPostPago', 'pendiente')
      setEstado('pendiente')
    }
  }, [intentos, estado])

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  if (estado === 'verificando') {
    return (
      <BasePagoLayout
        icon="⏳"
        title="Confirmando pago"
        description="Estamos verificando tu pago con Mercado Pago."
      />
    )
  }

  if (estado === 'aprobado') {
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

  if (estado === 'pendiente') {
    return (
      <BasePagoLayout
        icon="⚠️"
        title="Pago pendiente"
        description="El pago no se confirmó aún. Tu pedido quedó pendiente y el stock reservado."
      >
        <button className="btn primary" onClick={() => navigate('/historial')}>
          Ver mis pedidos
        </button>
        <button className="btn secondary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </BasePagoLayout>
    )
  }

  return (
    <BasePagoLayout
      icon="❌"
      title="Pago rechazado"
      description="No se pudo completar el pago. No se realizó ningún cargo."
    >
      <button className="btn primary" onClick={() => navigate('/')}>
        Intentar nuevamente
      </button>
    </BasePagoLayout>
  )
}
