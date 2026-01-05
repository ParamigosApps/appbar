import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../Firebase.js'
import { getDocs, collection } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { formatearEventoLinea } from '../utils/eventoUI'
import { swalEventosNoVigentes } from '../utils/swalUtils'
import { useLocation } from 'react-router-dom'

const EventosContext = createContext(null)

// ----------------------------------------
// Hook ÚNICO y seguro
// ----------------------------------------
export function useEvento() {
  const ctx = useContext(EventosContext)
  if (!ctx) {
    throw new Error('useEvento debe usarse dentro de EventoProvider')
  }
  return ctx
}

export function EventoProvider({ children }) {
  const [evento, setEvento] = useState(null)
  const [hayEventosVigentes, setHayEventosVigentes] = useState(null)

  const location = useLocation()

  const enPago =
    location.pathname.startsWith('/pago') ||
    location.pathname.startsWith('/resultado')

  useEffect(() => {
    if (enPago) {
      console.warn('⛔ EventoProvider: restauración bloqueada por pago')
      return
    }

    const guardado = localStorage.getItem('eventoActivo')
    if (!guardado) return

    try {
      const parsed = JSON.parse(guardado)
      if (parsed?.id) {
        setEvento(parsed)
      }
    } catch {
      localStorage.removeItem('eventoActivo')
    }
  }, [])

  function seleccionarEvento(ev) {
    setEvento(ev)
    localStorage.setItem('eventoActivo', JSON.stringify(ev))
  }

  function limpiarEvento() {
    if (enPago) {
      console.warn('⛔ limpiarEvento bloqueado por pago')
      return
    }

    setEvento(null)
    localStorage.removeItem('eventoActivo')
  }

  async function validarEventoVigente() {
    if (enPago) {
      console.warn('⛔ validarEventoVigente bloqueado por pago')
      return true
    }
    try {
      // 🔒 GUARD CLAUSE CRÍTICA
      if (!evento || !evento.id) {
        console.warn('⚠️ validarEventoVigente: evento nulo o inválido')
        return false
      }

      const snap = await getDocs(collection(db, 'eventos'))
      const ahora = new Date()

      const match = snap.docs.find(d => d.id === evento.id)
      if (!match) {
        limpiarEvento()
        return false
      }

      const data = match.data()

      const inicio = data.fechaInicio?.toDate
        ? data.fechaInicio.toDate()
        : new Date(data.fechaInicio)

      const fin = data.fechaFin?.toDate
        ? data.fechaFin.toDate()
        : data.fechaFin
        ? new Date(data.fechaFin)
        : null

      let vigente = false
      if (inicio && fin) vigente = inicio <= ahora && ahora <= fin
      else if (inicio) vigente = inicio.toDateString() === ahora.toDateString()

      if (!vigente) {
        setHayEventosVigentes(false)
        limpiarEvento()
        return false
      }

      setHayEventosVigentes(true)
      return true
    } catch (err) {
      console.error('❌ Error validando evento vigente:', err)
      return false
    }
  }

  // ======================================================
  // PEDIR SELECCIÓN DE EVENTO (TU LÓGICA ORIGINAL)
  // ======================================================
  async function pedirSeleccionEvento() {
    if (enPago) {
      console.warn('⛔ pedirSeleccionEvento bloqueado por pago')
      return false
    }

    const snap = await getDocs(collection(db, 'eventos'))
    const ahora = new Date()

    const eventosVigentes = snap.docs
      .map(d => {
        const data = d.data()

        const inicio = data.fechaInicio?.toDate
          ? data.fechaInicio.toDate()
          : new Date(data.fechaInicio)

        const fin = data.fechaFin?.toDate
          ? data.fechaFin.toDate()
          : data.fechaFin
          ? new Date(data.fechaFin)
          : null

        let vigente = false
        if (inicio && fin) vigente = inicio <= ahora && ahora <= fin
        else if (inicio)
          vigente = inicio.toDateString() === ahora.toDateString()

        return { id: d.id, ...data, inicio, vigente }
      })
      .filter(ev => ev.vigente)

    if (!eventosVigentes.length) {
      setHayEventosVigentes(false)

      // Buscar próximos eventos (aunque no estén vigentes)
      const proximos = snap.docs
        .map(d => {
          const data = d.data()
          const inicio = data.fechaInicio?.toDate
            ? data.fechaInicio.toDate()
            : new Date(data.fechaInicio)

          return inicio > ahora
            ? formatearEventoLinea({ ...data, inicio })
            : null
        })
        .filter(Boolean)
        .slice(0, 5)

      await swalEventosNoVigentes({ eventos: proximos })
      return false
    }

    setHayEventosVigentes(true)
    const html = `
      <select id="evento-select" class="swal2-select" style="width:100%">
        ${eventosVigentes
          .map(
            ev => `<option value="${ev.id}">
              ${formatearEventoLinea(ev)}
            </option>`
          )
          .join('')}
      </select>
    `

    const res = await Swal.fire({
      title: 'Elegí tu evento',
      html,
      confirmButtonText: 'Continuar',
      buttonsStyling: false,
      customClass: { confirmButton: 'swal-btn-confirm' },
      preConfirm: () => document.getElementById('evento-select')?.value,
    })

    const elegido = eventosVigentes.find(e => e.id === res.value)
    if (!elegido) return false

    const eventoFinal = {
      ...elegido,
      id: elegido.id,

      // normalizados
      fechaInicio: elegido.fechaInicio || null,
      fechaFin: elegido.fechaFin || null,
      horaInicio: elegido.horaInicio || null,
      horaFin: elegido.horaFin || null,
    }

    seleccionarEvento(eventoFinal)
    return eventoFinal
  }

  // ======================================================
  // PROVIDER
  // ======================================================
  return (
    <EventosContext.Provider
      value={{
        evento,
        hayEventosVigentes,
        seleccionarEvento,
        limpiarEvento,
        validarEventoVigente,
        pedirSeleccionEvento,
      }}
    >
      {children}
    </EventosContext.Provider>
  )
}
