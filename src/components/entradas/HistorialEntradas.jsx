import { useEffect } from 'react'
import { useEntradas } from '../../context/EntradasContext.jsx'
import { useFirebase } from '../../context/FirebaseContext.jsx'

import { formatearFecha } from '../../utils/utils'

export default function HistorialEntradas() {
  const { user } = useFirebase()
  const { historialEntradas, cargarHistorial } = useEntradas()

  useEffect(() => {
    if (user?.uid) {
      cargarHistorial(user.uid)
    }
  }, [user])

  // -------------------------------------------------------
  // ORDENAR POR fecha usada → más reciente primero
  // -------------------------------------------------------
  const entradasOrdenadas = [...historialEntradas].sort((a, b) => {
    const fa = new Date(a.usadoEn || a.fechaEvento || 0)
    const fb = new Date(b.usadoEn || b.fechaEvento || 0)
    return fb - fa
  })

  return (
    <div className="container py-3">
      <h2 className="fw-bold mb-3">Historial de entradas</h2>

      {entradasOrdenadas.length === 0 && (
        <p className="text-secondary">Todavía no tienes entradas usadas.</p>
      )}

      {entradasOrdenadas.map(e => {
        const estado =
          e.razon === 'expirada' ? (
            <span className="badge bg-danger">Expirada</span>
          ) : (
            <span className="badge bg-success">Usada</span>
          )

        return (
          <div key={e.id} className="card mb-3 shadow-sm">
            <div className="card-body">
              {/* Nombre del evento */}
              <h5 className="fw-semibold">{e.nombreEvento || e.nombre}</h5>

              {/* Fecha original del evento */}
              <p className="m-0">📅 {formatearFecha(e.fecha)}</p>

              {/* Lugar */}
              {e.lugar && <p className="m-0">📍 {e.lugar}</p>}

              {/* Horario */}
              {e.horario && <p className="m-0">🕑 {e.horario}</p>}

              {/* Estado */}
              <p className="mt-2 mb-1">
                <strong>Estado:</strong> {estado}
              </p>

              {/* Fecha de uso o expiración */}
              <p className="m-0">
                <strong>Usada / expirada:</strong>{' '}
                {formatearFecha(e.usadoEn || e.fechaEvento)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
