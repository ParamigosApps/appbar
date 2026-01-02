// --------------------------------------------------------------
// src/pages/PagoResultado.jsx — VERSIÓN FINAL BLINDADA
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'

import { showLoading, hideLoading } from '../services/loadingService.js'

// --------------------------------------------------------------
const POLL_INTERVAL = 3000 // 3s
const MAX_INTENTOS = 40 // ~2 minutos
// --------------------------------------------------------------

function normalizarEstado(raw) {
  const s = (raw || '').toLowerCase()

  if (['aprobado', 'approved', 'success'].includes(s)) return 'aprobado'
  if (
    [
      'rechazado',
      'rejected',
      'cancelled',
      'failure',
      'monto_invalido',
    ].includes(s)
  )
    return 'rechazado'

  return 'pendiente'
}

export default function PagoResultado() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const pagoId =
    params.get('external_reference') || localStorage.getItem('pagoIdEnProceso')

  const intervalRef = useRef(null)
  const intentosRef = useRef(0)
  const [estadoUI, setEstadoUI] = useState('verificando')

  // --------------------------------------------------------------
  // LOG DE MONTAJE / DESMONTAJE (CLAVE)
  // --------------------------------------------------------------
  useEffect(() => {
    console.log('🧠 PagoResultado MOUNT', { pagoId })
    return () => console.log('💥 PagoResultado UNMOUNT')
  }, [])

  // --------------------------------------------------------------
  // POLLING ÚNICO Y BLINDADO
  // --------------------------------------------------------------
  useEffect(() => {
    if (!pagoId) {
      console.warn('⚠️ PagoResultado sin pagoId')
      navigate('/')
      return
    }

    showLoading({
      title: 'Confirmando pago',
      text: 'Estamos verificando tu pago. Esto puede demorar unos instantes…',
    })

    const checkPago = async () => {
      intentosRef.current += 1

      console.log(
        `🔍 [PagoResultado] intento ${intentosRef.current}/${MAX_INTENTOS}`,
        { pagoId }
      )

      try {
        const ref = doc(db, 'pagos', pagoId)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          console.warn('⏳ Pago no existe aún en Firestore')
          return
        }

        const pago = snap.data()
        const estado = normalizarEstado(pago.estado)

        console.log('📄 Estado Firestore:', {
          estadoRaw: pago.estado,
          estadoNormalizado: estado,
        })

        // ------------------ APROBADO ------------------
        if (estado === 'aprobado') {
          localStorage.setItem('avisoPostPago', 'aprobado')
          localStorage.removeItem('pagoIdEnProceso')
          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
          return
        }

        // ------------------ RECHAZADO ------------------
        if (estado === 'rechazado') {
          localStorage.setItem('avisoPostPago', 'rechazado')
          localStorage.removeItem('pagoIdEnProceso')
          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
          return
        }

        // ------------------ TIMEOUT ------------------
        if (intentosRef.current >= MAX_INTENTOS) {
          console.warn('⏳ Timeout: sigue pendiente')
          localStorage.setItem('avisoPostPago', 'verificando')
          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
        }
      } catch (err) {
        console.error('❌ Error verificando pago:', err)
      }
    }

    // ejecutar inmediato
    checkPago()
    intervalRef.current = setInterval(checkPago, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      hideLoading()
    }
  }, [pagoId]) // ⛔ NO agregar navigate acá

  return null
}
