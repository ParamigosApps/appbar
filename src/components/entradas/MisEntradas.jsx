// --------------------------------------------------------------
// src/components/entradas/MisEntradas.jsx
// MIS ENTRADAS PRO 2025 — FINAL DEFINITIVO
// --------------------------------------------------------------

import React, { useEffect, useState, useRef } from 'react'
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
import Swal from 'sweetalert2'

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
  const mapRef = useRef({})

  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)

  // ============================================================
  // 🔥 ENTRADAS + PENDIENTES (SOLO UI, SIN NOTIFICAR)
  // ============================================================
  useEffect(() => {
    if (!user) return

    setLoading(true)
    mapRef.current = {}

    // -----------------------------
    // ENTRADAS APROBADAS
    // -----------------------------
    const qAprobadas = query(
      collection(db, 'entradas'),
      where('usuarioId', '==', user.uid),
      orderBy('creadoEn', 'desc')
    )

    const unsubAprobadas = onSnapshot(qAprobadas, snap => {
      snap.forEach(docSnap => {
        const e = docSnap.data()
        const id = docSnap.id

        const eventoKey = e.eventoId
        const loteKey = e.lote?.nombre || 'Entrada general'

        if (!mapRef.current[eventoKey]) {
          mapRef.current[eventoKey] = {
            eventoId: e.eventoId,
            nombreEvento: e.nombreEvento,
            lugar: e.lugar,
            fechaEvento: e.fechaEvento,
            horaInicio: e.horaInicio,
            horaFin: e.horaFin,
            lotes: {},
          }
        }

        if (!mapRef.current[eventoKey].lotes[loteKey]) {
          mapRef.current[eventoKey].lotes[loteKey] = {
            lote: e.lote || null,
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        mapRef.current[eventoKey].lotes[loteKey].ticketsAprobados.push({
          id,
          usado: e.usado === true,
        })
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

        if (!mapRef.current[eventoKey]) {
          mapRef.current[eventoKey] = {
            eventoId: p.eventoId,
            nombreEvento: p.eventoNombre,
            lugar: p.lugar,
            fechaEvento: p.fechaEvento,
            horaInicio: p.horaInicio,
            horaFin: p.horaFin,
            lotes: {},
          }
        }

        if (!mapRef.current[eventoKey].lotes[loteKey]) {
          mapRef.current[eventoKey].lotes[loteKey] = {
            lote: p.lote || null,
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        const cant = Number(p.cantidad) || 1
        for (let i = 0; i < cant; i++) {
          mapRef.current[eventoKey].lotes[loteKey].ticketsPendientes.push(
            `${id}_${i}`
          )
        }
      })

      setGrupos(Object.values(mapRef.current))
      setLoading(false)
    })

    return () => {
      unsubAprobadas()
      unsubPendientes()
    }
  }, [user])

  // ============================================================
  // MODAL QR
  // ============================================================
  const abrirModalQr = data => {
    setQrModal(data)

    setTimeout(() => {
      data.ticketsAprobados.forEach(t => {
        const cont = document.getElementById(`qr_${t.id}`)
        if (!cont) return

        generarEntradaQr({
          ticketId: t.id,
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
                  <div
                    key={i}
                    className="ticket-card mt-2 p-3 rounded-4 shadow-sm"
                  >
                    {/* HEADER */}
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div className="fw-bold">
                        🎟 {l.lote?.nombre || 'Entrada general'}
                      </div>

                      {pendientes > 0 ? (
                        <Badge color="warning">Pendiente</Badge>
                      ) : (
                        <Badge color="success">Listas para usar</Badge>
                      )}
                    </div>

                    {/* INFO */}
                    <div className="ticket-info text-muted mb-2">
                      <span>Cantidad:</span> <strong>{total}</strong>
                    </div>

                    {/* CTA */}
                    {aprobadas > 0 && (
                      <button
                        className="btn btn-dark btn-sm w-100 ticket-btn"
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

      {/* MODAL QR */}
      {qrModal && (
        <div className="qr-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-card" onClick={e => e.stopPropagation()}>
            <div className="qr-header">
              <p className="qr-title fw-bold mb-1">{qrModal.nombreEvento}</p>

              <p className="qr-sub text-muted mb-1">
                📅 {formatearSoloFecha(qrModal.fechaEvento)}
              </p>

              {qrModal.horaInicio && qrModal.horaFin && (
                <p className="qr-sub mb-1">
                  ⏰ {qrModal.horaInicio} a {qrModal.horaFin}
                </p>
              )}

              {qrModal.lugar && (
                <p className="qr-sub mb-1">📍 {qrModal.lugar}</p>
              )}

              {qrModal.lote?.nombre && (
                <p className="qr-sub fw-semibold">
                  🎟 {qrModal.lote.nombre}
                  {qrModal.lote?.incluyeConsumicion && ' 🍹'}
                </p>
              )}

              <div className="qr-divider" />
            </div>

            <div className="qr-scroll">
              {qrModal.ticketsAprobados.map((t, i) => (
                <div key={t.id} className={`qr-item ${t.usado ? 'usado' : ''}`}>
                  {t.usado && <div className="qr-overlay-usado">QR USADO</div>}

                  <div id={`qr_${t.id}`} className="qr-box"></div>

                  <button
                    className="btn swal-btn-confirm mt-1"
                    disabled={t.usado}
                  >
                    Descargar QR: #{i + 1}
                  </button>
                </div>
              ))}
            </div>

            <button
              className="swal-btn-alt mt-3"
              id="btn-cerrar"
              onClick={() => setQrModal(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
