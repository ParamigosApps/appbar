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
      // 🔥 LIMPIAR antes de reconstruir
      mapRef.current = {}

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

        const precioEntrada = Number(e.precioUnitario ?? e.precio ?? 0)

        if (!mapRef.current[eventoKey].lotes[loteKey]) {
          mapRef.current[eventoKey].lotes[loteKey] = {
            lote: e.lote || null,
            precioUnitario: precioEntrada,
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

        // Si el evento no existe todavía (caso raro pero posible)
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

        // Si el lote no existe
        if (!mapRef.current[eventoKey].lotes[loteKey]) {
          mapRef.current[eventoKey].lotes[loteKey] = {
            lote: p.lote || null,
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        // 🔒 IMPORTANTE: limpiar pendientes del lote antes de volver a cargarlas
        mapRef.current[eventoKey].lotes[loteKey].ticketsPendientes = []

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
  // ORDEN LOTES (FREE -> más caro)
  // ============================================================
  function parsePrecio(valor) {
    if (valor === null || valor === undefined) return 0
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

    // strings tipo "$5.000", "5.000", "5000", "ARS 7000"
    const soloDigitos = String(valor).replace(/[^\d]/g, '')
    const n = Number(soloDigitos)
    return Number.isFinite(n) ? n : 0
  }

  function getPrecioLote(l) {
    // 1) precio dentro del objeto lote
    const p1 = parsePrecio(l?.lote?.precio)
    const p2 = parsePrecio(l?.lote?.precioUnitario)

    // 2) fallback: si por algún motivo lo guardaste a nivel entrada/loteGroup
    const p3 = parsePrecio(l?.precio)
    const p4 = parsePrecio(l?.precioUnitario)

    return p1 || p2 || p3 || p4 || 0
  }

  function esFreeLote(l) {
    // Regla: FREE si el precio “real” da 0
    // (esto cubre lote null + precioUnitario 0, strings vacíos, etc.)
    return getPrecioLote(l) === 0
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
          grupos.map((g, idx) => {
            const tieneEntradasAprobadas = Object.values(g.lotes).some(
              l => l.ticketsAprobados.length > 0
            )

            return (
              <div key={idx} className="card p-3 shadow-sm rounded-4">
                <h5 className="fw-bold m-0">{g.nombreEvento}</h5>

                <p className="mb-0 mt-1">
                  📅 Fecha:{' '}
                  <strong> {formatearSoloFecha(g.fechaEvento)} </strong>— 🕑
                  Hora:
                  <strong>
                    {' '}
                    {g.horaInicio}hs a {g.horaFin}hs.
                  </strong>
                </p>

                <p className="mb-0">
                  📍 Dirección: <strong>{g.lugar}</strong>
                </p>

                {Object.values(g.lotes)
                  .sort((a, b) => a.precioUnitario - b.precioUnitario)

                  .map((l, i) => {
                    const aprobadas = l.ticketsAprobados.length
                    const pendientes = l.ticketsPendientes.length
                    const total = aprobadas + pendientes

                    const usadas = l.ticketsAprobados.filter(
                      t => t.usado
                    ).length
                    const todasDisponlibles = aprobadas > 0 && usadas === 0
                    const todasUsadas = aprobadas > 0 && usadas === aprobadas
                    const algunasUsadas = usadas > 0 && usadas < aprobadas
                    const textoUsadas =
                      usadas === 1 ? 'Entrada usada' : 'Entradas usadas'

                    const puedeAbrirQr = aprobadas > 0
                    return (
                      <>
                        <div
                          key={i}
                          className={`ticket-card rounded-4 shadow-sm ${
                            puedeAbrirQr ? 'ticket-clickable' : ''
                          } ${todasUsadas ? 'ticket-usado' : ''}`}
                          role={puedeAbrirQr ? 'button' : undefined}
                          tabIndex={puedeAbrirQr ? 0 : -1}
                          onClick={() => {
                            if (!puedeAbrirQr) return

                            abrirModalQr({
                              ...g,
                              lote: l.lote || null,
                              ticketsAprobados: l.ticketsAprobados,
                            })
                          }}
                          onKeyDown={e => {
                            if (!puedeAbrirQr) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              abrirModalQr({
                                ...g,
                                lote: l.lote || null,
                                ticketsAprobados: l.ticketsAprobados,
                              })
                            }
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <div className="fw-bold">
                              🎟 {l.lote?.nombre || 'Entrada general'}
                            </div>

                            {pendientes > 0 ? (
                              <Badge color="warning">Pendiente</Badge>
                            ) : todasUsadas ? (
                              <Badge color="secondary">No disponibles</Badge>
                            ) : (
                              <Badge color="success">Disponible</Badge>
                            )}
                          </div>

                          <div className="ticket-info text-muted">
                            Cantidad: <strong>{total}</strong>
                            {todasDisponlibles && (
                              <span className="ms-2 text-success fw-semibold">
                                · Todas disponibles
                              </span>
                            )}
                            {todasUsadas && (
                              <span className="ms-2 text-danger fw-semibold">
                                · Todas usadas
                              </span>
                            )}
                            {algunasUsadas && (
                              <span className="ms-2 text-danger fw-semibold">
                                · {usadas} {textoUsadas}
                              </span>
                            )}
                            {pendientes > 0 && (
                              <span className="ms-2 text-warning fw-semibold">
                                · Pendientes de aprobación
                              </span>
                            )}
                          </div>
                        </div>

                        {/* CTA separado, más limpio */}
                        {puedeAbrirQr && !todasUsadas && (
                          <button
                            className="btn btn-link p-0 fw-semibold text-primary"
                            onClick={() =>
                              abrirModalQr({
                                ...g,
                                lote: l.lote || null,
                                ticketsAprobados: l.ticketsAprobados,
                              })
                            }
                          ></button>
                        )}
                      </>
                    )
                  })}
              </div>
            )
          })
        )}
      </div>

      {/* MODAL QR */}
      {qrModal && (
        <div className="qr-overlay" onClick={() => setQrModal(null)}>
          <div className="qr-card" onClick={e => e.stopPropagation()}>
            <div className="qr-header">
              <p className="qr-title fw-bold mb-1">{qrModal.nombreEvento}</p>

              <p className="qr-lote fw-semibold mb-1">
                🎟 Lote: {qrModal.lote?.nombre || 'Entrada general'}
              </p>

              <p className="qr-sub text-muted mb-1">
                📅 Fecha: {formatearSoloFecha(qrModal.fechaEvento)}
              </p>

              {qrModal.horaInicio && qrModal.horaFin && (
                <p className="qr-sub mb-1">
                  ⏰ Horario: {qrModal.horaInicio} a {qrModal.horaFin}
                </p>
              )}

              {qrModal.lugar && (
                <p className="qr-sub mb-1">📍 Lugar: {qrModal.lugar}</p>
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
