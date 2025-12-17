// --------------------------------------------------------------
// EntradasEventos.jsx — VERSIÓN FINAL
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
  // NORMALIZAR LOTES
  // --------------------------------------------------------------
  function normalizarLotes(lotesRaw) {
    if (!lotesRaw) return []
    if (Array.isArray(lotesRaw)) return lotesRaw
    if (typeof lotesRaw === 'object') return Object.values(lotesRaw)
    return []
  }
  function formatearFecha(ts) {
    if (!ts?.toDate) return 'Fecha a confirmar'
    return ts.toDate().toLocaleDateString('es-AR')
  }

  function formatearHora(ts) {
    if (!ts?.toDate) return ''
    return ts.toDate().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, // 🔑 FORZAR 24 HS
    })
  }

  // --------------------------------------------------------------
  // CARGAR EVENTOS
  // --------------------------------------------------------------
  useEffect(() => {
    async function cargarEventos() {
      try {
        setLoading(true)

        const q = query(
          collection(db, 'eventos'),
          orderBy('fechaInicio', 'asc')
        )

        const snap = await getDocs(q)

        const lista = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

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
  // TEXTO DEL PRECIO (CONSIDERA LOTES)
  // --------------------------------------------------------------
  function getTextoPrecio(evento) {
    const lotes = normalizarLotes(evento.lotes)

    if (lotes.length > 0) {
      const precios = lotes
        .map(l => Number(l.precio) || 0)
        .filter(n => !isNaN(n))

      if (precios.includes(0)) return 'INCLUYE INGRESOS FREE'
      return `Desde $${Math.min(...precios)}`
    }

    if (!evento.precio || evento.precio < 1) return 'Entrada gratuita'
    return `$${evento.precio}`
  }

  // --------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------
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
        const lotes = normalizarLotes(evento.lotes)
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

            <p className="mb-0">📅 {formatearFecha(evento.fechaInicio)}</p>
            <p className="mb-0">📍 {evento.lugar || 'Lugar a confirmar'}</p>

            <p className="mb-0">
              🕑 Desde: {formatearHora(evento.fechaInicio)} hs → hasta{' '}
              {formatearHora(evento.fechaFin)} hs.
            </p>

            <p className="mt-2 mb-1">
              💲 <strong>{getTextoPrecio(evento)}</strong>
            </p>

            {/* LOTES */}
            {tieneLotes && (
              <div
                className="mt-2 mb-2 p-2 rounded"
                style={{ background: '#f8f9fa' }}
              >
                {lotes.map((lote, idx) => (
                  <div key={idx} className="small">
                    🎟 <strong>{lote.nombre || `Lote ${idx + 1}`}</strong> —{' '}
                    {Number(lote.precio) > 0 ? (
                      `$${lote.precio}`
                    ) : (
                      <span className="text-dark fw-bold">{' GRATIS '}</span>
                    )}
                    {lote.incluyeConsumicion && (
                      <span className="text-dark fw-bold">
                        {' | CON CONSUMICIÓN '}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* BOTÓN */}
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
