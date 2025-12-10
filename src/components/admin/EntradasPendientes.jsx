// --------------------------------------------------------------
// src/components/admin/EntradasPendientes.jsx — PREMIUM 2025 EXTENDED
// --------------------------------------------------------------
import { useEffect, useState, Fragment, useMemo } from 'react'
import {
  escucharEntradasPendientes,
  aprobarEntrada,
  rechazarEntrada,
} from '../../services/entradasAdmin.js'
import Swal from 'sweetalert2'

// --------------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------------
function normalizar(str) {
  return str
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// COLORES SEGÚN LOTE
const loteColors = {
  'Lote 1': '#0d6efd',
  'Lote 2': '#198754',
  'Lote 3': '#fd7e14',
  'Lote 4': '#dc3545',
}

// ORDENADORES
const ordenadores = {
  none: { label: 'Sin ordenar', fn: arr => arr },
  montoDesc: {
    label: 'Monto (alto → bajo)',
    fn: arr =>
      [...arr].sort((a, b) => {
        const tA = a.monto ?? a.precio * a.cantidad
        const tB = b.monto ?? b.precio * b.cantidad
        return tB - tA
      }),
  },
  eventoAsc: {
    label: 'Evento (A → Z)',
    fn: arr =>
      [...arr].sort((a, b) =>
        normalizar(a.eventoNombre).localeCompare(normalizar(b.eventoNombre))
      ),
  },
  fechaDesc: {
    label: 'Fecha (nuevo → viejo)',
    fn: arr =>
      [...arr].sort((a, b) =>
        (b.creadoEn || '').localeCompare(a.creadoEn || '')
      ),
  },
}

export default function EntradasPendientes() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [openEvent, setOpenEvent] = useState(null)

  // BUSQUEDA
  const [busqueda, setBusqueda] = useState('')

  // ORDEN
  const [orden, setOrden] = useState('none')

  // --------------------------------------------------------------
  // 🔥 Escucha en tiempo real
  // --------------------------------------------------------------
  useEffect(() => {
    const unsub = escucharEntradasPendientes(entradas => {
      setLista(entradas)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])

  // --------------------------------------------------------------
  // 🔥 ACCIONES
  // --------------------------------------------------------------
  async function handleAprobar(e) {
    const total = e.monto ?? (e.precio || 0) * (e.cantidad || 1)

    const ok = await Swal.fire({
      title: '¿Aprobar entrada?',
      width: 430,
      html: `
        <div style="text-align:left; font-size:14px; line-height:1.4;">
          <p><b>Usuario:</b> ${e.usuarioNombre}</p>
          <p><b>Evento:</b> ${e.eventoNombre}</p>

          ${
            e.fecha || e.horario
              ? `<p><b>Fecha / Hora:</b> ${e.fecha || ''} ${
                  e.horario ? '· ' + e.horario : ''
                }</p>`
              : ''
          }

          <p><b>Lote:</b> ${e.loteNombre || 'Sin lote'}</p>
          <p><b>Cantidad:</b> ${e.cantidad}</p>
          <p><b>Precio unitario:</b> $${e.precio}</p>

          <p style="margin-top:8px;">
            <b>Total a recibir:</b>
            <span style="color:#0d6efd; font-weight:bold;">$${total}</span>
          </p>

          <p><b>Método de pago:</b> Transferencia</p>

          ${
            e.notaAdmin
              ? `<p style="margin-top:8px;"><b>Nota interna:</b><br>${e.notaAdmin}</p>`
              : ''
          }
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    })

    if (!ok.isConfirmed) return

    const exito = await aprobarEntrada(e)
    if (!exito) return Swal.fire('Error', 'No se pudo aprobar.', 'error')

    Swal.fire('Listo', 'Entrada aprobada.', 'success')
  }

  async function handleRechazar(e) {
    const ok = await Swal.fire({
      title: '¿Rechazar solicitud?',
      text: `${e.usuarioNombre} — ${e.eventoNombre}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
    })

    if (!ok.isConfirmed) return

    const exito = await rechazarEntrada(e.id)
    if (!exito) return Swal.fire('Error', 'No se pudo rechazar.', 'error')

    Swal.fire('Listo', 'Solicitud rechazada.', 'info')
  }

  // --------------------------------------------------------------
  // 🔥 PROCESAR LISTA COMPLETA
  // --------------------------------------------------------------
  const procesada = useMemo(() => {
    let arr = [...lista]

    // BUSQUEDA — IGNORA ACENTOS
    if (busqueda.trim() !== '') {
      const b = normalizar(busqueda)
      arr = arr.filter(
        e =>
          normalizar(e.usuarioNombre || '').includes(b) ||
          normalizar(e.eventoNombre || '').includes(b)
      )
    }

    // ORDEN
    arr = ordenadores[orden].fn(arr)

    // AGRUPADO
    return arr.reduce((acc, e) => {
      if (!acc[e.eventoNombre]) acc[e.eventoNombre] = []
      acc[e.eventoNombre].push(e)
      return acc
    }, {})
  }, [lista, busqueda, orden])

  if (loading) return <p>Cargando...</p>

  // --------------------------------------------------------------
  // 🔥 UI FINAL
  // --------------------------------------------------------------
  return (
    <div>
      <h4 className="fw-bold mb-3">Entradas Pendientes</h4>

      {/* BUSQUEDA + ORDEN */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Buscar usuario o evento..."
          style={{ maxWidth: 240 }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <select
          className="form-select"
          value={orden}
          style={{ maxWidth: 200 }}
          onChange={e => setOrden(e.target.value)}
        >
          {Object.keys(ordenadores).map(k => (
            <option key={k} value={k}>
              {ordenadores[k].label}
            </option>
          ))}
        </select>
      </div>

      {Object.keys(procesada).length === 0 && (
        <p className="text-muted">No hay resultados.</p>
      )}

      {/* EVENTOS AGRUPADOS */}
      {Object.entries(procesada).map(([evento, entradas]) => {
        const isOpen = openEvent === evento

        // RESUMEN AVANZADO DEL EVENTO
        const totalSolicitudes = entradas.length
        const totalEntradas = entradas.reduce(
          (a, e) => a + (e.cantidad || 0),
          0
        )
        const totalMonto = entradas.reduce(
          (a, e) => a + (e.monto ?? e.precio * e.cantidad),
          0
        )

        return (
          <Fragment key={evento}>
            {/* CABECERA EVENTO SUPER PREMIUM */}
            <div
              className="rounded p-3 mb-2"
              style={{
                background: '#e8ecf1',
                cursor: 'pointer',
                borderLeft: '6px solid #0d6efd',
              }}
              onClick={() =>
                setOpenEvent(prev => (prev === evento ? null : evento))
              }
            >
              <div className="d-flex justify-content-between">
                <h5 className="fw-bold text-primary m-0">{evento}</h5>
                <span className="text-secondary fw-semibold">
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* RESUMEN */}
              <div
                className="mt-2"
                style={{ fontSize: '0.82rem', color: '#333', lineHeight: 1.25 }}
              >
                <b>{totalSolicitudes}</b> solicitudes • <b>{totalEntradas}</b>{' '}
                entradas pedidas • <b>${totalMonto}</b> total
              </div>
            </div>

            {/* LISTA DE SOLICITUDES */}
            {isOpen &&
              entradas.map(e => {
                const total = e.monto ?? e.precio * e.cantidad
                const colorLote = loteColors[e.loteNombre] || '#999'

                const montoAlto = total >= 20000 // badge automático
                const inconsistencias = !e.precio || !e.cantidad

                // frecuencia del usuario
                const comprasUsuario = lista.filter(
                  x => x.usuarioNombre === e.usuarioNombre
                ).length
                const usuarioFrecuente = comprasUsuario >= 5

                return (
                  <div
                    key={e.id}
                    className="shadow-sm p-2 mb-2 rounded d-flex justify-content-between align-items-center"
                    style={{
                      height: '75px',
                      background: '#fff',
                      borderLeft: `4px solid ${colorLote}`,
                    }}
                  >
                    {/* IZQUIERDA */}
                    <div
                      className="d-flex flex-column"
                      style={{ lineHeight: 1.2 }}
                    >
                      <strong>{e.usuarioNombre}</strong>

                      <div
                        className="text-muted"
                        style={{ fontSize: '0.78rem' }}
                      >
                        Lote: {e.loteNombre || '-'} • x{e.cantidad}
                      </div>

                      <div
                        className="fw-semibold"
                        style={{ fontSize: '0.8rem', color: '#0d6efd' }}
                      >
                        ${total}
                      </div>

                      {/* BADGES */}
                      <div className="d-flex gap-1 mt-1">
                        {montoAlto && (
                          <span className="badge bg-warning text-dark small">
                            Monto alto
                          </span>
                        )}

                        {usuarioFrecuente && (
                          <span className="badge bg-info text-dark small">
                            Cliente frecuente
                          </span>
                        )}

                        {inconsistencias && (
                          <span className="badge bg-danger small">
                            Datos incompletos
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DERECHA */}
                    <div className="d-flex align-items-center gap-2">
                      <button
                        onClick={() => handleAprobar(e)}
                        className="btn btn-success"
                        style={{ width: 40, height: 40, padding: 0 }}
                      >
                        ✓
                      </button>

                      <button
                        onClick={() => handleRechazar(e)}
                        className="btn btn-danger"
                        style={{ width: 40, height: 40, padding: 0 }}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                )
              })}
          </Fragment>
        )
      })}
    </div>
  )
}
