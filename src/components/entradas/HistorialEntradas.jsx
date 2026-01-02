import { useEffect, useMemo } from 'react'
import { useEntradas } from '../../context/EntradasContext.jsx'
import { useFirebase } from '../../context/FirebaseContext.jsx'

import {
  formatearFecha,
  formatearFechaEventoDescriptiva,
} from '../../utils/utils'

export default function HistorialEntradas() {
  const { user } = useFirebase()
  const { historialEntradas, cargarHistorial } = useEntradas()

  useEffect(() => {
    if (user?.uid) {
      cargarHistorial(user.uid)
    }
  }, [user])

  // ======================================================
  // AGRUPAR POR EVENTO (MIS ENTRADAS STYLE)
  // ======================================================
  const eventos = useMemo(() => {
    const map = {}

    historialEntradas.forEach(e => {
      const key = e.eventoId || e.nombreEvento

      if (!map[key]) {
        map[key] = {
          nombreEvento: e.nombreEvento || e.nombre,
          fechaEvento: e.fechaEvento,
          horaInicio: e.horaInicio,
          horaFin: e.horaFin,
          lugar: e.lugar,
          entradas: [],
        }
      }

      map[key].entradas.push(e)
    })

    return Object.values(map)
  }, [historialEntradas])

  if (!user) {
    return (
      <p className="text-danger text-center mt-3">
        Debés iniciar sesión para ver tu historial.
      </p>
    )
  }

  if (eventos.length === 0) {
    return (
      <p className="text-secondary text-center mt-3">
        Todavía no tenés entradas usadas o expiradas.
      </p>
    )
  }

  return (
    <div className="container py-3">
      <h2 className="fw-bold mb-3">Historial de entradas</h2>

      <div className="d-flex flex-column gap-3">
        {eventos.map((ev, i) => {
          const total = ev.entradas.length
          const usadas = ev.entradas.filter(e => e.usado).length

          const ultimaValidacion = ev.entradas
            .map(e => e.usadoEn)
            .filter(Boolean)
            .sort((a, b) => b.seconds - a.seconds)[0]

          return (
            <div key={i} className="card historial-card p-3 shadow-sm">
              {/* HEADER */}
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="evento-title mb-0">{ev.nombreEvento}</h5>

                  <div className="evento-meta">
                    📅{' '}
                    <strong>
                      {formatearFecha(ev.fechaEvento, ev.horaInicio)}
                      {ev.horaFin && <> – {ev.horaFin} hs</>}
                    </strong>
                  </div>

                  {ev.lugar && <div className="evento-meta">📍 {ev.lugar}</div>}
                </div>

                <span className="badge bg-success">Finalizado</span>
              </div>

              <div className="evento-divider" />

              {/* INFO */}
              <div className="d-flex flex-wrap gap-2 mb-2">
                <span className="badge bg-secondary">
                  🎟 {total} {total > 1 ? 'entradas' : 'entrada'}
                </span>

                <span className="badge bg-light text-dark border">
                  {usadas} usadas
                </span>
              </div>

              {/* VALIDACIÓN */}
              {ultimaValidacion && (
                <div className="validacion-box">
                  ✅ <strong>Última validación</strong> el{' '}
                  <strong>{formatearFecha(ultimaValidacion)}</strong>
                </div>
              )}

              {/* CREACIÓN */}
              <div className="text-muted small mt-1 mx-1">
                Creada el {formatearFecha(ev.entradas[0].creadoEn)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
