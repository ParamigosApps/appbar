// --------------------------------------------------------------
// src/components/entradas/MisEntradas.jsx
// MIS ENTRADAS PRO 2025 — FINAL DEFINITIVO
// --------------------------------------------------------------
import React, { useEffect, useState, useRef, Fragment } from 'react'
import {
  doc,
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

function descargarQr({ ticketId, nombreEvento, loteNombre, index }) {
  const canvas = document.querySelector(`#qr_${ticketId} canvas`)
  if (!canvas) {
    Swal.fire('Error', 'No se pudo generar el QR', 'error')
    return
  }

  const dataUrl = canvas.toDataURL('image/png')

  // Normalizar texto para filename
  const slug = str =>
    str
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const nombreArchivo =
    [
      slug(nombreEvento).toUpperCase(),
      slug(loteNombre || 'entrada').toUpperCase(),
      `#${index + 1}`,
    ].join('-') + '.png'
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

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

  const eventosCache = useRef({})
  const eventosUnsub = useRef({})
  // ============================================================
  // 🔥 ENTRADAS + PENDIENTES (SOLO UI, SIN NOTIFICAR)
  // ============================================================
  useEffect(() => {
    if (!user) return

    setLoading(true)
    Object.values(mapRef.current).forEach(ev => {
      Object.values(ev.lotes || {}).forEach(l => {
        l.ticketsAprobados = []
      })
    })

    // -----------------------------
    // ENTRADAS APROBADAS
    // -----------------------------
    const qAprobadas = query(
      collection(db, 'entradas'),
      where('usuarioId', '==', user.uid),
      orderBy('creadoEn', 'desc')
    )

    const unsubAprobadas = onSnapshot(qAprobadas, snap => {
      // 🔥 LIMPIAR APROBADAS ANTES DE RECONSTRUIR
      Object.values(mapRef.current).forEach(ev => {
        Object.values(ev.lotes || {}).forEach(l => {
          l.ticketsAprobados = []
        })
      })

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
            loteIndice: Number.isFinite(e.loteIndice) ? e.loteIndice : null,
            precioUnitario: Number(e.precioUnitario ?? e.precio ?? 0),
            ticketsAprobados: [],
            ticketsPendientes: [],
          }
        }

        mapRef.current[eventoKey].lotes[loteKey].ticketsAprobados.push({
          id,
          usado: e.usado === true,
        })
      })

      setGrupos(Object.values(mapRef.current))
    })

    // -----------------------------
    // ENTRADAS PENDIENTES
    // -----------------------------
    const qPendientes = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const unsubPendientes = onSnapshot(qPendientes, snap => {
      Object.values(mapRef.current).forEach(ev => {
        Object.values(ev.lotes || {}).forEach(l => {
          l.ticketsPendientes = []
        })
      })
      snap.forEach(docSnap => {
        const p = docSnap.data()
        const id = docSnap.id

        const eventoKey = p.eventoId
        const loteKey = p.lote?.nombre || p.loteNombre || 'Entrada general'

        // Si el evento no existe todavía (caso raro pero posible)
        if (!mapRef.current[eventoKey]) {
          mapRef.current[eventoKey] = {
            eventoId: p.eventoId,
            nombreEvento: p.nombre || 'Evento',
            lugar: p.lugar ?? '',
            fechaEvento: p.fechaEvento ?? null,
            horaInicio: p.horaInicio ?? '',
            horaFin: p.horaFin ?? '',
            lotes: {},
          }
        } else {
          // 🔒 NO tocar nombreEvento si ya existe
          mapRef.current[eventoKey].nombreEvento ||= p.eventoNombre
        }

        // Si el lote no existe
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

      Object.values(eventosUnsub.current).forEach(unsub => {
        if (typeof unsub === 'function') unsub()
      })

      eventosUnsub.current = {}
      eventosCache.current = {}
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

  function calcularPorcentajeDisponible(eventoId, loteIndice) {
    const evento = eventosCache.current[eventoId]
    if (!evento || !Array.isArray(evento.lotes)) return null

    const lote = evento.lotes[loteIndice]
    if (!lote) return null

    const total = Number(lote.cantidadInicial || 0)
    const disponibles = Number(lote.cantidad || 0)

    if (total <= 0) return null

    return Math.round((disponibles / total) * 100)
  }

  function getBarColor(p) {
    if (p <= 20) return 'danger'
    if (p <= 30) return 'warning'
    return 'success'
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
            console.log(g.nombreEvento)
            return (
              <div key={idx} className="card p-3 shadow-sm rounded-4">
                <h5 className="fw-bold m-0">{g.nombreEvento}</h5>

                <p className="mb-0 mt-1">
                  📅 Fecha :{' '}
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
                    const lenghDisponibles = l.ticketsAprobados.length - usadas
                    const lenghPendientes = l.ticketsPendientes.length
                    const porcentaje = calcularPorcentajeDisponible(
                      g.eventoId,
                      l.loteIndice
                    )

                    const mostrarBarra =
                      Number.isFinite(porcentaje) &&
                      porcentaje <= 30 &&
                      !esFreeLote(l)

                    const todasDisponibles =
                      aprobadas > 0 &&
                      usadas === 0 &&
                      l.ticketsPendientes.length == 0
                    const algunasDisponibles =
                      aprobadas > 0 && usadas < aprobadas

                    const todasUsadas = aprobadas > 0 && usadas === aprobadas
                    const algunasUsadas = usadas > 0 && usadas < aprobadas

                    const textoUsadas =
                      usadas === 1 ? 'Entrada usada' : 'Entradas usadas'
                    const textoAlgunasDisponibles =
                      aprobadas - usadas === 1
                        ? 'Entrada disponible'
                        : 'Entradas disponibles'
                    const textoPendientes =
                      l.ticketsPendientes.length === 1
                        ? 'Entrada pendiente'
                        : 'Entradas pendientes'

                    const textoCortoUsadas = usadas === 1 ? 'Usada' : 'Usadas'
                    const textoCortoDisponibles =
                      aprobadas - usadas === 1 ? 'Disponible' : 'Disponibles'
                    const textoCortoPendientes =
                      l.ticketsPendientes.length === 1
                        ? 'Pendiente'
                        : 'Pendientes'
                    const puedeAbrirQr = aprobadas > 0

                    // 🔑 KEY ESTABLE (NO usar solo index)
                    const loteKey =
                      l.lote?.id || l.lote?.nombre || `${g.eventoId}_${i}`

                    return (
                      <Fragment key={loteKey}>
                        <div
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
                            {todasDisponibles &&
                              usadas === 0 &&
                              pendientes === 0 && (
                                <span className="ms-2 text-success fw-semibold">
                                  · Todas disponibles
                                </span>
                              )}
                            {todasUsadas && (
                              <span className="ms-2 text-danger fw-semibold">
                                · Todas usadas
                              </span>
                            )}
                            {algunasDisponibles &&
                              !todasDisponibles &&
                              algunasUsadas &&
                              pendientes < 1 && (
                                <span className="ms-2 text-success fw-semibold">
                                  · {lenghDisponibles} {textoAlgunasDisponibles}{' '}
                                  <span className=" text-danger fw-semibold">
                                    · {usadas} {textoUsadas}
                                  </span>
                                </span>
                              )}
                            {pendientes > 0 &&
                              !algunasDisponibles &&
                              !algunasUsadas && (
                                <span className="ms-2 d-inline-flex align-items-center gap-2">
                                  <span className="text-warning fw-semibold">
                                    · {lenghPendientes} {textoPendientes}
                                  </span>
                                </span>
                              )}
                            {algunasDisponibles &&
                              pendientes > 0 &&
                              !algunasUsadas && (
                                <span className="ms-2 d-inline-flex align-items-center gap-2">
                                  <span className="text-success fw-semibold">
                                    · {lenghDisponibles}{' '}
                                    {textoAlgunasDisponibles}
                                  </span>

                                  <span className="text-warning fw-semibold">
                                    · {lenghPendientes} {textoCortoPendientes}
                                  </span>
                                </span>
                              )}
                            {algunasDisponibles &&
                              pendientes > 0 &&
                              algunasUsadas && (
                                <span className="ms-2 d-inline-flex align-items-center gap-2">
                                  <span className="text-success fw-semibold">
                                    · {lenghDisponibles} {textoCortoDisponibles}
                                  </span>

                                  <span className=" text-danger fw-semibold">
                                    · {usadas} {textoCortoUsadas}
                                  </span>

                                  <span className="text-warning fw-semibold">
                                    · {lenghPendientes} {textoCortoPendientes}
                                  </span>
                                </span>
                              )}
                          </div>

                          {/* 🔴🟡 BARRA DE DISPONIBILIDAD */}
                          {mostrarBarra && !esFreeLote(l) && (
                            <div className="mt-2">
                              <div className="progress" style={{ height: 8 }}>
                                <div
                                  className={`progress-bar bg-${getBarColor(
                                    porcentaje
                                  )}`}
                                  role="progressbar"
                                  style={{ width: `${porcentaje}%` }}
                                  aria-valuenow={porcentaje}
                                  aria-valuemin="0"
                                  aria-valuemax="100"
                                />
                              </div>

                              <small
                                className={`fw-semibold text-${getBarColor(
                                  porcentaje
                                )}`}
                              >
                                ⚠️ Quedan solo {porcentaje}% de entradas
                                disponibles
                              </small>
                            </div>
                          )}
                        </div>

                        {/* CTA separado */}
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
                          />
                        )}
                      </Fragment>
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
                    onClick={() =>
                      descargarQr({
                        ticketId: t.id,
                        nombreEvento: qrModal.nombreEvento,
                        loteNombre: qrModal.lote?.nombre,
                        index: i,
                      })
                    }
                  >
                    Descargar QR #{i + 1}
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
