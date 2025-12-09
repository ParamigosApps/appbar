// --------------------------------------------------------------
// EntradasEventos.jsx — Versión con LOGS de diagnóstico
// --------------------------------------------------------------
import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase.js'
import { useEntradas } from '../../context/EntradasContext.jsx'

export default function EntradasEventos() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  const { pedirEntrada } = useEntradas()

  // --------------------------------------------------------------
  // 🔍 NORMALIZAR LOTES (con logs)
  // --------------------------------------------------------------
  function normalizarLotes(lotesRaw, eventoId) {
    if (!lotesRaw) {
      console.log('❌ lotesRaw es NULL/undefined')
      return []
    }

    if (Array.isArray(lotesRaw)) {
      return lotesRaw
    }

    if (typeof lotesRaw === 'object') {
      const arr = Object.values(lotesRaw)

      return arr
    }

    return []
  }

  // --------------------------------------------------------------
  // Cargar eventos
  // --------------------------------------------------------------
  useEffect(() => {
    async function cargarEventos() {
      try {
        setLoading(true)

        const q = query(collection(db, 'eventos'), orderBy('fecha', 'asc'))
        const snap = await getDocs(q)

        const lista = snap.docs.map(doc => {
          const data = doc.data()

          return {
            id: doc.id,
            ...data,
          }
        })

        setEventos(lista)
      } catch (error) {
        console.error('❌ Error cargando eventos:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarEventos()
  }, [])

  // --------------------------------------------------------------
  // Texto del precio (considera lotes)
  // --------------------------------------------------------------
  function getTextoPrecio(evento) {
    const lotes = normalizarLotes(evento.lotes, evento.id)

    if (lotes.length > 0) {
      const precios = lotes
        .map(l => Number(l.precio) || 0)
        .filter(n => !isNaN(n))

      if (precios.includes(0)) return 'Desde $0 (lotes gratuitos disponibles)'
      return `Desde $${Math.min(...precios)}`
    }

    if (!evento.precio || evento.precio < 1) return 'Entrada gratuita'
    return `$${evento.precio}`
  }

  if (loading)
    return <p className="text-center text-muted my-3">Cargando eventos...</p>

  if (eventos.length === 0)
    return (
      <p className="text-center text-secondary my-3">
        No hay eventos disponibles.
      </p>
    )

  return (
    <div className="d-flex flex-column gap-3 mt-3">
      {eventos.map(evento => {
        const imgUrl = evento.imagenEventoUrl || evento.imagen || ''

        const lotes = normalizarLotes(evento.lotes, evento.id)
        const tieneLotes = lotes.length > 0

        return (
          <div key={evento.id} className="card p-3 shadow-sm rounded-4">
            {/* Imagen */}
            {imgUrl && (
              <img
                src={imgUrl}
                alt={evento.nombre}
                className="w-100 rounded-3 mb-2"
                style={{ maxHeight: '180px', objectFit: 'cover' }}
              />
            )}

            <h5 className="fw-bold">{evento.nombre}</h5>

            <p className="mb-0">📅 {evento.fecha || 'Fecha a confirmar'}</p>
            <p className="mb-0">📍 {evento.lugar || 'Lugar a confirmar'}</p>

            {evento.horario && evento.horario.trim() !== '' && (
              <p className="mb-0">🕑 {evento.horario}</p>
            )}

            <p className="mt-2 mb-1">
              💲 <strong>{getTextoPrecio(evento)}</strong>
            </p>

            {/* Mostrar LOTES */}
            {tieneLotes && (
              <div
                className="mt-2 mb-2 p-2 rounded"
                style={{ background: '#f8f9fa' }}
              >
                {lotes.map((lote, idx) => (
                  <div key={idx} className="small">
                    🎟 <strong>{lote.nombre || `Lote ${idx + 1}`}</strong> —{' '}
                    {Number(lote.precio) > 0 ? `$${lote.precio}` : 'Gratis'}
                    {lote.incluyeConsumicion && ' · 🍹 consumición incluida'}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-dark mt-2 w-100"
              onClick={() => pedirEntrada(evento)}
            >
              {tieneLotes ? 'Ver opciones de entrada' : 'Pedir entrada'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
