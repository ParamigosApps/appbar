// --------------------------------------------------------------
// src/components/entradas/MisEntradas.jsx
// MIS ENTRADAS PRO 2025 — REALTIME FINAL
// --------------------------------------------------------------

import React, { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../Firebase.js'

import { useFirebase } from '../../context/FirebaseContext.jsx'
import { generarEntradaQr } from '../../services/generarQrService.js'
import { formatearSoloFecha } from '../../utils/utils.js'

// ============================================================
// BADGE
// ============================================================
function Badge({ children, color = 'secondary' }) {
  return (
    <span className={`badge rounded-pill bg-${color}`} style={{ fontSize: 12 }}>
      {children}
    </span>
  )
}

// ============================================================
// COMPONENTE
// ============================================================
export default function MisEntradas() {
  const { user } = useFirebase()

  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)

  // ============================================================
  // 🔥 REALTIME: ENTRADAS + PENDIENTES
  // ============================================================
  useEffect(() => {
    if (!user) return

    setLoading(true)

    let map = {}

    // -----------------------------
    // ENTRADAS APROBADAS
    // -----------------------------
    const qAprobadas = query(
      collection(db, 'entradas'),
      where('usuarioId', '==', user.uid),
      orderBy('creadoEn', 'desc')
    )

    const unsubAprobadas = onSnapshot(qAprobadas, snap => {
      map = {}

      snap.forEach(docSnap => {
        const e = docSnap.data()
        const id = docSnap.id

        const eventoKey = e.eventoId
        const loteKey = e.lote?.nombre || 'Entrada general'

        if (!map[eventoKey]) {
          map[eventoKey] = {
            eventoId: e.eventoId,
            nombreEvento: e.nombreEvento,
            lugar: e.lugar,
            fechaEvento: e.fechaEvento,
            horaInicio: e.horaInicio,
            horaFin: e.horaFin,
            lotes: {},
          }
        }

        if (!map[eventoKey].lotes[loteKey]) {
          map[eventoKey].lotes[loteKey] = {
            lote: e.lote || null,
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        map[eventoKey].lotes[loteKey].ticketsAprobados.push(id)
      })
    })

    // -----------------------------
    // ENTRADAS PENDIENTES
    // -----------------------------
    const qPendientes = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const unsubPendientes = onSnapshot(qPendientes, snap => {
      snap.forEach(docSnap => {
        const p = docSnap.data()
        const id = docSnap.id

        const eventoKey = p.eventoId
        const loteKey = p.lote?.nombre || p.loteNombre || 'Entrada general'

        if (!map[eventoKey]) {
          map[eventoKey] = {
            eventoId: p.eventoId,
            nombreEvento: p.eventoNombre,
            lugar: p.lugar,
            fechaEvento: p.fechaEvento,
            horaInicio: p.horaInicio,
            horaFin: p.horaFin,
            lotes: {},
          }
        }

        if (!map[eventoKey].lotes[loteKey]) {
          map[eventoKey].lotes[loteKey] = {
            lote: p.lote || null,
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        const cant = Number(p.cantidad) || 1
        for (let i = 0; i < cant; i++) {
          map[eventoKey].lotes[loteKey].ticketsPendientes.push(id + '_' + i)
        }
      })

      setGrupos(Object.values(map))
      setLoading(false)
    })

    return () => {
      unsubAprobadas()
      unsubPendientes()
    }
  }, [user])

  // ============================================================
  // ABRIR MODAL QR
  // ============================================================
  const abrirModalQr = data => {
    setQrModal(data)

    setTimeout(() => {
      data.ticketsAprobados.forEach(ticketId => {
        const cont = document.getElementById(`qr_${ticketId}`)
        if (!cont) return

        generarEntradaQr({
          ticketId,
          qrContainer: cont,
          eventoNombre: data.nombreEvento,
          loteNombre: data.lote?.nombre || 'Entrada general',
          fecha: formatearSoloFecha(data.fechaEvento),
          horarioIngreso:
            data.lote?.desdeHora && data.lote?.hastaHora
              ? `${data.lote.desdeHora}–${data.lote.hastaHora}`
              : `${data.horaInicio} - ${data.horaFin}`,
        })
      })
    }, 300)
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (!user) {
    return (
      <p className="text-center text-danger mt-3">
        Debés iniciar sesión para ver tus entradas.
      </p>
    )
  }

  if (loading) {
    return <p className="text-center text-muted my-3">Cargando entradas…</p>
  }

  return (
    <>
      <div className="d-flex flex-column gap-3 mt-3 mb-5">
        {grupos.length === 0 ? (
          <p className="text-center text-secondary">No tenés entradas aún.</p>
        ) : (
          grupos.map((g, idx) => (
            <div key={idx} className="card p-3 shadow-sm rounded-4">
              <h5 className="fw-bold m-0">{g.nombreEvento}</h5>

              <p className="mb-0 mt-1">
                📅 {formatearSoloFecha(g.fechaEvento)} — 🕑 {g.horaInicio} a{' '}
                {g.horaFin}
              </p>

              <p className="mb-0">📍 {g.lugar}</p>

              {Object.values(g.lotes).map((l, i) => {
                const aprobadas = l.ticketsAprobados.length
                const pendientes = l.ticketsPendientes.length
                const total = aprobadas + pendientes

                return (
                  <div key={i} className="mt-2 p-2 rounded bg-light small">
                    <div className="d-flex justify-content-between">
                      <strong>🎟 {l.lote?.nombre || 'Entrada general'}</strong>

                      {pendientes > 0 && (
                        <Badge color="warning">PENDIENTE</Badge>
                      )}
                      {pendientes === 0 && aprobadas > 0 && (
                        <Badge color="primary">APROBADA</Badge>
                      )}
                    </div>

                    <div className="text-muted d-flex justify-content-between">
                      <span>Cantidad: {total}</span>
                    </div>

                    {aprobadas > 0 && (
                      <button
                        className="btn btn-dark btn-sm w-100 mt-1"
                        onClick={() =>
                          abrirModalQr({
                            ...g,
                            ...l,
                          })
                        }
                      >
                        {aprobadas === 1 ? 'Ver entrada' : 'Ver entradas'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* ================= MODAL QR ================= */}
      {qrModal && (
        <div className="qr-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-card" onClick={e => e.stopPropagation()}>
            <div className="qr-header">
              <p className="qr-title fw-bold mb-1">{qrModal.nombreEvento}</p>
              <p className="qr-sub text-muted mb-1">
                📅 {formatearSoloFecha(qrModal.fechaEvento)}
              </p>
            </div>

            <div className="qr-divider"></div>

            <div className="qr-scroll">
              {qrModal.ticketsAprobados.map((id, i) => (
                <div key={id} className="qr-item">
                  <div id={`qr_${id}`} className="qr-box"></div>
                  <button className="btn btn-sm btn-dark mt-2">
                    Entrada #{i + 1}
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
