import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'

const POLL_INTERVAL = 3000
const MAX_INTENTOS = 10

function normalizarStatus(status) {
  const s = (status || '').toLowerCase()
  if (s === 'success' || s === 'approved') return 'success'
  if (s === 'failure' || s === 'rejected') return 'failure'
  if (s === 'pending' || s === 'in_process') return 'pending'
  return 'unknown'
}

export default function PagoResultado() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const statusQuery = normalizarStatus(params.get('status'))
  const pagoId = params.get('external_reference')

  const [estadoReal, setEstadoReal] = useState('cargando')
  const [pago, setPago] = useState(null)
  const [pollingFinalizado, setPollingFinalizado] = useState(false)
  const [navegando, setNavegando] = useState(false)

  const intentosRef = useRef(0)
  const intervalRef = useRef(null)

  // --------------------------------------------------
  // REGISTRAR PAGO PENDIENTE (si MP no confirmó)
  // --------------------------------------------------
  useEffect(() => {
    if (!user?.uid || !pagoId) return

    if (statusQuery === 'pending' || statusQuery === 'success') {
      fetch('/api/registrar-pago-pendiente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagoId,
          userId: user.uid,
        }),
      }).catch(() => {})
    }
  }, [user, pagoId, statusQuery])

  // --------------------------------------------------
  // POLLING FIRESTORE
  // --------------------------------------------------
  useEffect(() => {
    if (!user?.uid || !pagoId) {
      setEstadoReal('desconocido')
      return
    }

    async function cargarEstadoPago() {
      try {
        const snap = await getDoc(doc(db, 'pagos', pagoId))

        if (!snap.exists()) {
          setEstadoReal('pendiente')
        } else {
          const docPago = { id: snap.id, ...snap.data() }
          setPago(docPago)

          const estado = (docPago.estado || '').toLowerCase()

          if (['aprobado', 'fallido', 'monto_invalido'].includes(estado)) {
            setEstadoReal(estado)
            detenerPolling()
            return
          }

          setEstadoReal('pendiente')
        }

        intentosRef.current += 1
        if (intentosRef.current >= MAX_INTENTOS) {
          setPollingFinalizado(true)
          detenerPolling()
        }
      } catch (err) {
        console.error('❌ Error cargando pago:', err)
        setEstadoReal('desconocido')
        detenerPolling()
      }
    }

    function detenerPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    cargarEstadoPago()
    intervalRef.current = setInterval(cargarEstadoPago, POLL_INTERVAL)

    return detenerPolling
  }, [user, pagoId])

  // --------------------------------------------------
  // UX INICIAL
  // --------------------------------------------------
  useEffect(() => {
    if (statusQuery === 'success') {
      Swal.fire({
        title: 'Pago recibido',
        text: 'Estamos confirmando tu pago. Esto puede tardar unos segundos.',
        icon: 'info',
        timer: 2500,
        showConfirmButton: false,
      })
    }
  }, [statusQuery])

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------
  function irMisEntradas() {
    if (navegando) return
    setNavegando(true)
    navigate('/mis-entradas')
  }

  function irInicio() {
    if (navegando) return
    setNavegando(true)
    navigate('/')
  }

  function actualizarEstadoManual() {
    intentosRef.current = 0
    setPollingFinalizado(false)
    setEstadoReal('cargando')
  }

  // --------------------------------------------------
  // UI STATE
  // --------------------------------------------------
  const ui = (() => {
    if (estadoReal === 'pendiente' && pollingFinalizado) {
      return {
        titulo: 'Pago en verificación',
        texto:
          'Tu pago está pendiente de confirmación.\n\n' +
          'Si ya pagaste, no vuelvas a hacerlo. El sistema lo validará automáticamente.',
      }
    }

    switch (estadoReal) {
      case 'cargando':
        return { titulo: 'Verificando pago', texto: 'Procesando pago…' }
      case 'aprobado':
        return {
          titulo: 'Pago aprobado',
          texto: 'Tu pago fue confirmado. Tus entradas ya están disponibles.',
        }
      case 'monto_invalido':
        return {
          titulo: 'Pago en revisión',
          texto:
            'Detectamos una inconsistencia con el monto. El equipo lo revisará.',
        }
      case 'fallido':
        return {
          titulo: 'Pago rechazado',
          texto: 'El pago no se pudo completar.',
        }
      default:
        return {
          titulo: 'Pago no encontrado',
          texto:
            'No encontramos un pago reciente.\nSi pagaste, revisá “Mis Entradas”.',
        }
    }
  })()

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 16 }}>
      <div className="swal-popup-custom" style={{ padding: 22 }}>
        <h2>{ui.titulo}</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{ui.texto}</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="swal-btn-confirm" onClick={irMisEntradas}>
            Ver Mis Entradas
          </button>
          <button className="swal-btn-cancel" onClick={irInicio}>
            Volver al inicio
          </button>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>
          Si cerrás esta pantalla, tu pago se procesa igual.
        </p>
      </div>
    </div>
  )
}
