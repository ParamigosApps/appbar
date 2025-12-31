// src/pages/PagoResultado.jsx
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'

import { showLoading, hideLoading } from '../services/loadingService.js'

const POLL_INTERVAL = 2000
const MAX_INTENTOS = 10

export default function PagoResultado() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // 🔑 CLAVE: fallback a localStorage
  const pagoId =
    params.get('external_reference') || localStorage.getItem('pagoIdEnProceso')
  const intervalRef = useRef(null)
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    showLoading({
      title: 'Confirmando pago',
      text: 'Estamos verificando tu pago…',
    })

    if (!pagoId) {
      console.warn('⚠️ PagoResultado sin pagoId')
      localStorage.setItem('avisoPostPago', 'rechazado')
      hideLoading()
      navigate('/')
      return
    }

    const check = async () => {
      try {
        const ref = doc(db, 'pagos', pagoId)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          setIntentos(i => i + 1)
          return
        }

        const pago = snap.data()

        if (pago.estado === 'aprobado') {
          localStorage.setItem('avisoPostPago', 'aprobado')
          localStorage.removeItem('pagoIdEnProceso') // 🧹 limpiar
          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
          return
        }

        if (['fallido', 'monto_invalido'].includes(pago.estado)) {
          localStorage.setItem('avisoPostPago', 'rechazado')
          localStorage.removeItem('pagoIdEnProceso') // 🧹 limpiar
          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
          return
        }

        setIntentos(i => i + 1)
      } catch (err) {
        console.error('❌ Error verificando pago:', err)
        setIntentos(i => i + 1)
      }
    }

    intervalRef.current = setInterval(check, POLL_INTERVAL)
    check() // ejecutar inmediato

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      hideLoading()
    }
  }, [pagoId, navigate])

  // ⏳ Timeout → pendiente
  useEffect(() => {
    if (intentos >= MAX_INTENTOS) {
      localStorage.setItem('avisoPostPago', 'pendiente')
      localStorage.removeItem('pagoIdEnProceso') // 🧹 limpiar
      if (intervalRef.current) clearInterval(intervalRef.current)
      hideLoading()
      navigate('/')
    }
  }, [intentos, navigate])

  // 👉 No renderiza nada
  return null
}
