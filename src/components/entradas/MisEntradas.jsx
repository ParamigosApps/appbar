// --------------------------------------------------------------
// src/components/entradas/MisEntradas.jsx — VERSIÓN FINAL FUNCIONAL
// --------------------------------------------------------------

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../Firebase.js'

import { useFirebase } from '../../context/FirebaseContext.jsx'
import { generarEntradaQr } from '../../services/generarQrService.js'

export default function MisEntradas() {
  const { user } = useFirebase()
  const [entradasAgrupadas, setEntradasAgrupadas] = useState({})
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)

  // ============================================================
  // Cargar entradas por usuario
  // ============================================================
  useEffect(() => {
    const cargar = async () => {
      try {
        if (!user) {
          setEntradasAgrupadas({})
          setLoading(false)
          return
        }

        const q = query(
          collection(db, 'entradas'),
          where('usuarioId', '==', user.uid)
        )

        const snap = await getDocs(q)
        const map = {}

        snap.forEach(docSnap => {
          const data = docSnap.data()
          const ticketId = docSnap.id
          const key = data.eventoId || ticketId

          if (!map[key]) {
            map[key] = { ...data, tickets: [ticketId] }
          } else {
            map[key].tickets.push(ticketId)
          }
        })

        setEntradasAgrupadas(map)
      } catch (err) {
        console.error('Error cargando entradas:', err)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [user])

  // ============================================================
  // Abrir modal y generar QR dentro del DOM (lo que SI funciona)
  // ============================================================
  const abrirModalQr = entrada => {
    if (!user) return

    // Muestra el modal vacío primero
    setQrModal(entrada)

    // Luego generamos los QR dentro de los contenedores reales
    setTimeout(() => {
      entrada.tickets.forEach(ticketId => {
        const contenedor = document.getElementById(`qr_${ticketId}`)
        if (!contenedor) return

        generarEntradaQr({
          ticketId,
          nombreEvento: entrada.nombre,
          usuario: user.displayName || 'Usuario',
          fecha: entrada.fecha,
          lugar: entrada.lugar,
          horario: entrada.horario ?? 'A confirmar',
          precio:
            entrada.precio === 0 || entrada.precio == null
              ? 'Entrada gratuita'
              : `$${entrada.precio}`,
          qrContainer: contenedor,
          individual: true,
        })
      })
    }, 300) // se deja así porque tu script realmente lo necesita
  }

  // ============================================================
  // Render
  // ============================================================

  if (!user) {
    return (
      <p className="text-center text-danger mt-3">
        Debes iniciar sesión para ver tus entradas.
      </p>
    )
  }

  if (loading) {
    return <p className="text-center text-muted my-3">Cargando...</p>
  }

  const listaEntradas = Object.values(entradasAgrupadas)

  return (
    <>
      {/* LISTADO */}
      <div className="d-flex flex-column gap-3 mt-3 mb-5">
        {listaEntradas.length === 0 ? (
          <p className="text-center text-secondary">No tenés entradas aún.</p>
        ) : (
          listaEntradas.map(e => (
            <div
              key={e.eventoId || e.tickets[0]}
              className="card p-3 shadow-sm rounded-4"
            >
              <h5 className="fw-bold">{e.nombreEvento}</h5>

              {e.fecha && <p className="mb-0">📅 {e.fecha}</p>}
              <p className="mb-0">📍 {e.lugar}</p>
              {e.horario && <p className="mb-0">🕑 {e.horario}</p>}

              <p className="mt-2">
                🎫 <strong>{e.tickets.length}</strong> entradas
              </p>

              <button
                className="btn btn-dark mt-2 w-100"
                onClick={() => abrirModalQr(e)}
              >
                Ver QR
              </button>
            </div>
          ))
        )}
      </div>

      {/* MODAL QR */}
      {/* MODAL QR — PROFESIONAL + DESCARGA */}
      {qrModal && (
        <div className="qr-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-card" onClick={e => e.stopPropagation()}>
            {/* Datos del evento */}
            <p className="qr-title fw-bold">{qrModal.nombreEvento}</p>
            {qrModal.fecha && <p className="qr-sub">📅 {qrModal.fecha}</p>}
            <p className="qr-sub">📍 {qrModal.lugar}</p>
            {qrModal.horario && <p className="qr-sub">🕑 {qrModal.horario}</p>}

            <div className="qr-divider"></div>

            {/* LISTA SCROLLEABLE */}
            <div className="qr-scroll">
              {qrModal.tickets.map((ticketId, i) => (
                <div key={ticketId} className="qr-item">
                  {/* CONTENEDOR PARA EL QR */}
                  <div id={`qr_${ticketId}`} className="qr-box"></div>

                  {/* BOTÓN DESCARGAR */}
                  <button
                    className="btn btn-sm btn-dark mt-3 mb-5"
                    onClick={() => descargarQR(ticketId, i + 1)}
                  >
                    Descargar: Entrada #{i + 1}
                  </button>
                </div>
              ))}
            </div>

            {/* CERRAR */}
            <button className="qr-btn" onClick={() => setQrModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
// =========================
// DESCARGAR QR COMO PNG
// =========================
const descargarQR = (ticketId, nro) => {
  const cont = document.getElementById(`qr_${ticketId}`)
  if (!cont) return

  // Puede ser IMG, CANVAS o SVG → buscamos cualquiera
  const salida = cont.querySelector('img, canvas, svg')
  if (!salida) {
    console.warn('No se encontró QR para descargar')
    return
  }

  let dataUrl = ''

  if (salida.tagName === 'IMG') {
    dataUrl = salida.src
  } else if (salida.tagName === 'CANVAS') {
    dataUrl = salida.toDataURL('image/png')
  } else if (salida.tagName === 'SVG') {
    const svgData = new XMLSerializer().serializeToString(salida)
    dataUrl = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  // Nombre pro
  const nombreArchivo = `Entrada_${nro}_${ticketId}.png`

  // Crear descarga
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = nombreArchivo
  link.click()
}
