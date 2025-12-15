// --------------------------------------------------------------
// src/components/entradas/MisEntradas.jsx — MIS ENTRADAS PRO 2025
// --------------------------------------------------------------

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase.js'

import { useFirebase } from '../../context/FirebaseContext.jsx'
import { generarEntradaQr } from '../../services/generarQrService.js'
import { formatearSoloFecha } from '../../utils/utils.js'

// ============================================================
// BADGES
// ============================================================
function Badge({ children, color = 'secondary' }) {
  return (
    <span className={`badge rounded-pill bg-${color}`} style={{ fontSize: 12 }}>
      {children}
    </span>
  )
}

// ============================================================
// FORMATEAR HORA 24HS
// ============================================================
function formatearHora(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function MisEntradas() {
  const { user } = useFirebase()

  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)

  // ============================================================
  // CARGAR ENTRADAS
  // ============================================================
  useEffect(() => {
    async function cargar() {
      if (!user) {
        setGrupos([])
        setLoading(false)
        return
      }

      try {
        const q = query(
          collection(db, 'entradas'),
          where('usuarioId', '==', user.uid),
          orderBy('creadoEn', 'desc')
        )

        const snap = await getDocs(q)

        const map = {}

        snap.forEach(docSnap => {
          const e = docSnap.data()
          const id = docSnap.id

          // 🔑 Clave: evento + lote + estado
          const key = [e.eventoId, e.lote?.id || 'sin-lote', e.estado].join('|')

          if (!map[key]) {
            map[key] = {
              ...e,
              tickets: [id],
            }
          } else {
            map[key].tickets.push(id)
          }
        })

        setGrupos(Object.values(map))
      } catch (err) {
        console.error('❌ Error cargando entradas:', err)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [user])

  // ============================================================
  // ABRIR MODAL QR
  // ============================================================
  const abrirModalQr = grupo => {
    setQrModal(grupo)

    setTimeout(() => {
      grupo.tickets.forEach(ticketId => {
        const cont = document.getElementById(`qr_${ticketId}`)
        if (!cont) return

        generarEntradaQr({
          ticketId,
          nombreEvento: grupo.nombreEvento,
          usuario: user.displayName || 'Usuario',
          fecha: grupo.fechaEvento,
          lugar: grupo.lugar,
          horario: `${grupo.horaInicio} - ${grupo.horaFin}`,
          precio:
            grupo.precioUnitario === 0 ? 'FREE' : `$${grupo.precioUnitario}`,
          qrContainer: cont,
          individual: true,
        })
      })
    }, 300)
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (!user)
    return (
      <p className="text-center text-danger mt-3">
        Debés iniciar sesión para ver tus entradas.
      </p>
    )

  if (loading)
    return <p className="text-center text-muted my-3">Cargando entradas…</p>

  return (
    <>
      {/* LISTADO */}
      <div className="d-flex flex-column gap-3 mt-3 mb-5">
        {grupos.length === 0 ? (
          <p className="text-center text-secondary">No tenés entradas aún.</p>
        ) : (
          grupos.map((g, idx) => (
            <div key={idx} className="card p-3 shadow-sm rounded-4">
              {/* HEADER */}
              <div className="d-flex justify-content-between align-items-start">
                <h5 className="fw-bold m-0">{g.nombreEvento}</h5>

                {g.estado === 'aprobada' && g.metodo === 'free' && (
                  <Badge color="success">FREE</Badge>
                )}
                {g.estado === 'pendiente' && (
                  <Badge color="warning">PENDIENTE</Badge>
                )}
                {g.estado === 'aprobada' && g.metodo !== 'free' && (
                  <Badge color="primary">PAGADA</Badge>
                )}
                {g.usado && <Badge color="dark">USADA</Badge>}
              </div>

              {/* INFO */}
              <p className="mb-0 mt-1">
                📅 {formatearSoloFecha(g.fechaEvento)} — 🕑 {g.horaInicio} a{' '}
                {g.horaFin}
              </p>

              <p className="mb-0">📍 {g.lugar}</p>

              {/* LOTE */}
              {g.lote && (
                <div className="mt-2 p-2 rounded bg-light small">
                  🎟 <strong>{g.lote.nombre}</strong>
                  {g.lote.incluyeConsumicion && (
                    <span className="ms-2">🍹 Incluye consumición</span>
                  )}
                  <div className="text-muted">
                    {g.lote.genero !== 'todos' && `Género: ${g.lote.genero}`}
                  </div>
                </div>
              )}

              {/* CANTIDAD */}
              <p className="mt-2 mb-1">
                🎫 <strong>{g.tickets.length}</strong> entrada(s)
              </p>

              <button
                className="btn btn-dark mt-2 w-100"
                onClick={() => abrirModalQr(g)}
              >
                Ver QR
              </button>
            </div>
          ))
        )}
      </div>

      {/* MODAL QR */}
      {qrModal && (
        <div className="qr-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-card" onClick={e => e.stopPropagation()}>
            <p className="qr-title fw-bold">{qrModal.nombreEvento}</p>

            <p className="qr-sub">
              📅 {formatearSoloFecha(qrModal.fechaEvento)} — 🕑{' '}
              {qrModal.horaInicio} a {qrModal.horaFin}
            </p>

            <p className="qr-sub">📍 {qrModal.lugar}</p>

            {qrModal.lote && (
              <p className="qr-sub">
                🎟 {qrModal.lote.nombre}
                {qrModal.lote.incluyeConsumicion && ' 🍹'}
              </p>
            )}

            <div className="qr-divider"></div>

            <div className="qr-scroll">
              {qrModal.tickets.map((id, i) => (
                <div key={id} className="qr-item">
                  <div id={`qr_${id}`} className="qr-box"></div>

                  <button
                    className="btn btn-sm btn-dark mt-3 mb-5"
                    onClick={() => descargarQR(id, i + 1)}
                  >
                    Descargar QR #{i + 1}
                  </button>
                </div>
              ))}
            </div>

            <button className="qr-btn" onClick={() => setQrModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// DESCARGAR QR
// ============================================================
function descargarQR(ticketId, nro) {
  const cont = document.getElementById(`qr_${ticketId}`)
  if (!cont) return

  const el = cont.querySelector('img, canvas, svg')
  if (!el) return

  let dataUrl = ''

  if (el.tagName === 'IMG') dataUrl = el.src
  else if (el.tagName === 'CANVAS') dataUrl = el.toDataURL('image/png')
  else {
    const svg = new XMLSerializer().serializeToString(el)
    dataUrl = 'data:image/svg+xml;base64,' + btoa(svg)
  }

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `Entrada_${nro}_${ticketId}.png`
  a.click()
}
