import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../Firebase.js'
import { getDocs, collection } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { formatearEventoLinea } from '../utils/eventoUI'
const EventosContext = createContext(null)

// ----------------------------------------
// Hook ÚNICO y correcto
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

  function seleccionarEvento(ev) {
    setEvento(ev)
    localStorage.setItem('eventoActivo', JSON.stringify(ev))
  }

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
      nombre: elegido.nombre,
      fechaInicio: elegido.fechaInicio || null,
      horaInicio: elegido.horaInicio || null,
    }

    seleccionarEvento(eventoFinal)

    return eventoFinal
  }

  return (
    <EventosContext.Provider
      value={{
        evento,
        seleccionarEvento,
        pedirSeleccionEvento,
      }}
    >
      {children}
    </EventosContext.Provider>
  )
}
