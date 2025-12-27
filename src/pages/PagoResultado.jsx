import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../Firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import Swal from 'sweetalert2'

// --------------------------------------------------
// CONFIG
// --------------------------------------------------
const POLL_INTERVAL = 3000 // 3s
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
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const statusQuery = normalizarStatus(params.get('status'))

  const [estadoReal, setEstadoReal] = useState('cargando')
  const [pago, setPago] = useState(null)
  const [pollingFinalizado, setPollingFinalizado] = useState(false)
  const [navegando, setNavegando] = useState(false)

  const intentosRef = useRef(0)
  const intervalRef = useRef(null)

  // --------------------------------------------------
  // CARGAR + POLLING
  // --------------------------------------------------
  useEffect(() => {
    if (!user?.uid) {
      setEstadoReal('desconocido')
      return
    }

    async function cargarEstadoPago() {
      try {
        const q = query(
          collection(db, 'pagos'),
          where('usuarioId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(1)
        )

        const snap = await getDocs(q)

        if (snap.empty) {
          setEstadoReal('desconocido')
          return
        }

        const docPago = { id: snap.docs[0].id, ...snap.docs[0].data() }
        setPago(docPago)

        const estado = (docPago.estado || '').toLowerCase()

        if (estado === 'aprobado') {
          setEstadoReal('aprobado')
          detenerPolling()
        } else if (estado === 'monto_invalido') {
          setEstadoReal('monto_invalido')
          detenerPolling()
        } else if (estado === 'fallido') {
          setEstadoReal('fallido')
          detenerPolling()
        } else {
          setEstadoReal('pendiente')
        }

        intentosRef.current += 1
        if (intentosRef.current >= MAX_INTENTOS) {
          setPollingFinalizado(true)
          detenerPolling()
        }
      } catch (err) {
        console.error('❌ Error polling pago:', err)
        detenerPolling()
        setEstadoReal('desconocido')
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
  }, [user])

  // --------------------------------------------------
  // MENSAJE UX INICIAL (NO CONFIRMA)
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
    document.dispatchEvent(new Event('abrir-mis-entradas'))
  }

  function irInicio() {
    if (navegando) return
    setNavegando(true)
    window.location.href = '/'
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
          'Tu pago está siendo verificado por el proveedor.\n\nEsto puede demorar unos minutos. No es necesario que vuelvas a pagar.',
      }
    }

    switch (estadoReal) {
      case 'cargando':
        return {
          titulo: 'Cargando...',
          texto: 'Estamos verificando el estado de tu pago.',
        }
      case 'aprobado':
        return {
          titulo: 'Pago aprobado',
          texto: 'Tu pago fue confirmado. Tus entradas ya están disponibles.',
        }
      case 'monto_invalido':
        return {
          titulo: 'Pago en revisión',
          texto:
            'Detectamos una inconsistencia con el monto. El equipo lo revisará y te contactará si es necesario.',
        }
      case 'fallido':
        return {
          titulo: 'Pago rechazado',
          texto: 'El pago no se pudo completar. Podés intentarlo nuevamente.',
        }
      case 'pendiente':
        return {
          titulo: 'Pago en proceso',
          texto:
            'Tu pago todavía está siendo confirmado. Esta pantalla se actualizará automáticamente.',
        }
      default:
        return {
          titulo: 'Pago no encontrado',
          texto:
            'No encontramos un pago reciente asociado a tu cuenta. Si pagaste, esperá unos segundos y revisá “Mis Entradas”.',
        }
    }
  })()

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 16 }}>
      <div className="swal-popup-custom" style={{ padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{ui.titulo}</h2>

        <p style={{ marginTop: 12, whiteSpace: 'pre-line' }}>{ui.texto}</p>

        {/* ---------------- DETALLE DEL PAGO ---------------- */}
        {pago && (
          <div style={{ marginTop: 14, fontSize: 14, opacity: 0.9 }}>
            <div>
              <b>Método:</b>{' '}
              {pago.metodo === 'mp' ? 'Mercado Pago' : pago.metodo || '—'}
            </div>

            <div>
              <b>Total:</b> ${Number(pago.total || 0).toLocaleString('es-AR')}
            </div>

            {pago.createdAt?.toDate && (
              <div>
                <b>Fecha:</b> {pago.createdAt.toDate().toLocaleString('es-AR')}
              </div>
            )}

            {pago.paymentId && (
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  navigator.clipboard.writeText(pago.paymentId)
                  Swal.fire({
                    toast: true,
                    position: 'bottom',
                    icon: 'success',
                    title: 'Referencia copiada',
                    showConfirmButton: false,
                    timer: 1500,
                  })
                }}
              >
                <b>Referencia MP:</b> {pago.paymentId} 📋
              </div>
            )}
          </div>
        )}

        {/* ---------------- ACCIONES ---------------- */}
        <div
          style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}
        >
          <button className="swal-btn-confirm" onClick={irMisEntradas}>
            Ver Mis Entradas
          </button>

          <button className="swal-btn-cancel" onClick={irInicio}>
            Volver al inicio
          </button>

          {estadoReal === 'pendiente' && (
            <button
              className="swal-btn-cancel"
              onClick={actualizarEstadoManual}
            >
              Actualizar estado
            </button>
          )}

          {(estadoReal === 'monto_invalido' ||
            (estadoReal === 'pendiente' && pollingFinalizado)) && (
            <button
              className="swal-btn-cancel"
              onClick={() =>
                window.open(
                  'https://wa.me/549XXXXXXXXXX?text=Hola, tengo un pago en revisión.',
                  '_blank'
                )
              }
            >
              Contactar soporte
            </button>
          )}
        </div>

        <p style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>
          Si cerrás esta pantalla, tu pago se procesa igual.
        </p>
      </div>
    </div>
  )
}
