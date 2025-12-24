import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../Firebase.js'
import { doc, getDoc } from 'firebase/firestore'

const EventosContext = createContext(null)

export function EventoProvider({ children }) {
  const [evento, setEvento] = useState(null)

  // ----------------------------------------
  // Cargar evento guardado al iniciar
  // ----------------------------------------
  useEffect(() => {
    const guardado = localStorage.getItem('eventoActivo')
    if (guardado) {
      try {
        setEvento(JSON.parse(guardado))
      } catch {
        localStorage.removeItem('eventoActivo')
      }
    }
  }, [])

  // ----------------------------------------
  // Seleccionar evento
  // ----------------------------------------
  function seleccionarEvento(ev) {
    setEvento(ev)
    localStorage.setItem('eventoActivo', JSON.stringify(ev))
  }

  // ----------------------------------------
  // Limpiar evento
  // ----------------------------------------
  function limpiarEvento() {
    setEvento(null)
    localStorage.removeItem('eventoActivo')
  }

  // ----------------------------------------
  // Validar si el evento sigue vigente
  // ----------------------------------------
  async function validarEventoVigente() {
    if (!evento?.id) return false

    const ref = doc(db, 'eventos', evento.id)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      limpiarEvento()
      return false
    }

    const data = snap.data()
    const ahora = new Date()

    const inicio = data.fechaInicio?.toDate
      ? data.fechaInicio.toDate()
      : new Date(data.fechaInicio)

    const fin = data.fechaFin?.toDate
      ? data.fechaFin.toDate()
      : data.fechaFin
      ? new Date(data.fechaFin)
      : null

    let vigente = false

    if (inicio && fin) {
      vigente = inicio <= ahora && ahora <= fin
    } else if (inicio) {
      vigente = inicio.toDateString() === ahora.toDateString()
    }

    if (!vigente) {
      limpiarEvento()
      return false
    }

    // refrescar snapshot
    seleccionarEvento({
      id: snap.id,
      nombre: data.nombre,
      fechaInicio: data.fechaInicio || null,
      horaInicio: data.horaInicio || null,
    })

    return true
  }

  return (
    <EventosContext.Provider
      value={{
        evento,
        seleccionarEvento,
        limpiarEvento,
        validarEventoVigente,
      }}
    >
      {children}
    </EventosContext.Provider>
  )
}

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
