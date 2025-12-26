import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../Firebase.js'
import { getDocs, collection } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { formatearEventoLinea } from '../utils/eventoUI'

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

  // ======================================================
  // SELECCIONAR EVENTO
  // ======================================================
  function seleccionarEvento(ev) {
    setEvento(ev)
    localStorage.setItem('eventoActivo', JSON.stringify(ev))
  }

  // ======================================================
  // LIMPIAR EVENTO (🔥 FALTABA)
  // ======================================================
  function limpiarEvento() {
    setEvento(null)
    localStorage.removeItem('eventoActivo')
  }

  // ======================================================
  // VALIDAR EVENTO VIGENTE (🔥 FALTABA)
  // ======================================================
  async function validarEventoVigente() {
    if (!evento) return false

    try {
      const snap = await getDocs(collection(db, 'eventos'))
      const ahora = new Date()

      const match = snap.docs.find(d => d.id === evento.id)
      if (!match) return false

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
        limpiarEvento()
      }

      return vigente
    } catch (err) {
      console.error('❌ Error validando evento vigente:', err)
      return false
    }
  }

  // ======================================================
  // PEDIR SELECCIÓN DE EVENTO (TU LÓGICA ORIGINAL)
  // ======================================================
  async function pedirSeleccionEvento() {
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
      await Swal.fire('Sin eventos', 'No hay eventos activos.', 'info')
      return false
    }

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
      id: elegido.id,
      ...elegido,

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
