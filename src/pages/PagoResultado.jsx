// --------------------------------------------------------------
// src/pages/PagoResultado.jsx — FINAL DEFINITIVO
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'

import { showLoading, hideLoading } from '../services/loadingService.js'

// --------------------------------------------------------------
// CONFIG
// --------------------------------------------------------------
const POLL_INTERVAL = 2000
const MAX_INTENTOS = 10

// --------------------------------------------------------------
// NORMALIZAR ESTADO MERCADO PAGO
// --------------------------------------------------------------
function normalizarEstadoMP(raw) {
  const s = (raw || '').toLowerCase()

  if (['approved', 'success'].includes(s)) return 'aprobado'
  if (['rejected', 'failure', 'cancelled'].includes(s)) return 'rechazado'
  if (['in_process', 'pending', 'authorized'].includes(s)) return 'pendiente'

  return 'pendiente'
}

// --------------------------------------------------------------
// COMPONENTE
// --------------------------------------------------------------
export default function PagoResultado() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // 🔑 external_reference o fallback local
  const pagoId =
    params.get('external_reference') || localStorage.getItem('pagoIdEnProceso')

  const intervalRef = useRef(null)
  const [intentos, setIntentos] = useState(0)

  // --------------------------------------------------------------
  // VERIFICAR PAGO
  // --------------------------------------------------------------
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

    const checkPago = async () => {
      try {
        const ref = doc(db, 'pagos', pagoId)
        const snap = await getDoc(ref)

        // Aún no llegó el webhook
        if (!snap.exists()) {
          setIntentos(i => i + 1)
          return
        }

        const pago = snap.data()
        const estado = normalizarEstadoMP(pago.estado)

        // -----------------------------
        // ✅ APROBADO
        // -----------------------------
        if (estado === 'aprobado') {
          localStorage.setItem('avisoPostPago', 'aprobado')
          localStorage.removeItem('pagoIdEnProceso')

          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/') // o /mis-entradas si preferís
          return
        }

        // -----------------------------
        // ❌ RECHAZADO
        // -----------------------------
        if (estado === 'rechazado') {
          localStorage.setItem('avisoPostPago', 'rechazado')
          localStorage.removeItem('pagoIdEnProceso')

          clearInterval(intervalRef.current)
          hideLoading()
          navigate('/')
          return
        }

        // -----------------------------
        // ⏳ PENDIENTE → seguir esperando
        // -----------------------------
        setIntentos(i => i + 1)
      } catch (err) {
        console.error('❌ Error verificando pago:', err)
        setIntentos(i => i + 1)
      }
    }

    // Ejecutar inmediato + polling
    checkPago()
    intervalRef.current = setInterval(checkPago, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      hideLoading()
    }
  }, [pagoId, navigate])

  // --------------------------------------------------------------
  // ⏱️ TIMEOUT → PENDIENTE
  // --------------------------------------------------------------
  useEffect(() => {
    if (intentos >= MAX_INTENTOS) {
      localStorage.setItem('avisoPostPago', 'pendiente')
      localStorage.removeItem('pagoIdEnProceso')

      if (intervalRef.current) clearInterval(intervalRef.current)
      hideLoading()
      navigate('/')
    }
  }, [intentos, navigate])

  // --------------------------------------------------------------
  // NO RENDER
  // --------------------------------------------------------------
  return null
}
