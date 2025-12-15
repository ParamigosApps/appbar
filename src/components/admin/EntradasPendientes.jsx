// --------------------------------------------------------------
// src/components/admin/EntradasPendientes.jsx — PREMIUM 2025 FINAL
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

function formatearFechaAdmin(fecha) {
  if (!fecha) return ''
  if (fecha.toDate) return fecha.toDate().toLocaleDateString('es-AR')
  return fecha
}

// COLORES SEGÚN LOTE
const loteColors = {
  VIP: '#dc3545',
  General: '#0d6efd',
  'Entrada general': '#0d6efd',
}

// ORDENADORES
const ordenadores = {
  none: { label: 'Sin ordenar', fn: arr => arr },
  montoDesc: {
    label: 'Monto (alto → bajo)',
    fn: arr =>
      [...arr].sort((a, b) => {
        const tA =
          (Number(a.precioUnitario) ||
            Number(a.lote?.precio) ||
            Number(a.precio) ||
            0) * (Number(a.cantidad) || 1)

        const tB =
          (Number(b.precioUnitario) ||
            Number(b.lote?.precio) ||
            Number(b.precio) ||
            0) * (Number(b.cantidad) || 1)

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
}

// ============================================================
// COMPONENTE
// ============================================================
export default function EntradasPendientes() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('none')

  // ------------------------------------------------------------
  // 🔥 Escucha realtime
  // ------------------------------------------------------------
  useEffect(() => {
    const unsub = escucharEntradasPendientes(data => {
      setLista(data)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])

  // ------------------------------------------------------------
  // 🔥 APROBAR
  // ------------------------------------------------------------
  async function handleAprobar(e) {
    const precioUnitario =
      Number(e.precioUnitario) ||
      Number(e.lote?.precio) ||
      Number(e.precio) ||
      0

    const cantidad = Number(e.cantidad) || 1
    const total = precioUnitario * cantidad

    const nombreLote = e.lote?.nombre || e.loteNombre || 'Entrada general'

    const ok = await Swal.fire({
      title: '¿Aprobar entrada?',
      width: 430,
      html: `
        <div style="text-align:left; font-size:14px; line-height:1.4;">
          <p><b>Usuario:</b> ${e.usuarioNombre}</p>
          <p><b>Evento:</b> ${e.eventoNombre}</p>
          <p><b>Fecha / Hora:</b>
            ${formatearFechaAdmin(e.fechaEvento || e.fecha)}
            ${e.horario ? ' · ' + e.horario : ''}
          </p>
          <p><b>Lote:</b> ${nombreLote}</p>
          <p><b>Cantidad:</b> ${cantidad}</p>
          <p><b>Precio unitario:</b> $${precioUnitario}</p>
          <p style="margin-top:8px;">
            <b>Total a recibir:</b>
            <span style="color:#0d6efd; font-weight:bold;">$${total}</span>
          </p>
          <p><b>Método de pago:</b> Transferencia</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    })

    if (!ok.isConfirmed) return

    const entradaNormalizada = {
      ...e,
      precioUnitario,
      lote: e.lote ?? {
        nombre: nombreLote,
        precio: precioUnitario,
      },
    }

    const exito = await aprobarEntrada(entradaNormalizada)
    if (!exito) return Swal.fire('Error', 'No se pudo aprobar.', 'error')

    Swal.fire('Listo', 'Entrada aprobada.', 'success')
  }

  // ------------------------------------------------------------
  // ❌ RECHAZAR
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // 🔥 PROCESAR LISTA
  // ------------------------------------------------------------
  const procesada = useMemo(() => {
    let arr = [...lista]

    if (busqueda.trim()) {
      const b = normalizar(busqueda)
      arr = arr.filter(
        e =>
          normalizar(e.usuarioNombre || '').includes(b) ||
          normalizar(e.eventoNombre || '').includes(b)
      )
    }

    arr = ordenadores[orden].fn(arr)

    return arr.reduce((acc, e) => {
      const loteNombre = e.lote?.nombre || e.loteNombre || 'Entrada general'

      const key = `${e.eventoNombre}__${loteNombre}`

      if (!acc[key]) {
        acc[key] = {
          eventoNombre: e.eventoNombre,
          loteNombre,
          entradas: [],
        }
      }

      acc[key].entradas.push(e)
      return acc
    }, {})
  }, [lista, busqueda, orden])

  if (loading) return <p>Cargando…</p>

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <div>
      <h4 className="fw-bold mb-3">Entradas Pendientes</h4>

      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Buscar usuario o evento…"
          style={{ maxWidth: 240 }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={orden}
          onChange={e => setOrden(e.target.value)}
        >
          {Object.entries(ordenadores).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {Object.entries(procesada).map(([key, grupo]) => {
        const { eventoNombre, loteNombre, entradas } = grupo
        const isOpen = openKey === key

        const totalEntradas = entradas.reduce(
          (a, e) => a + (Number(e.cantidad) || 0),
          0
        )

        const totalMonto = entradas.reduce(
          (a, e) =>
            a +
            (Number(e.precioUnitario) ||
              Number(e.lote?.precio) ||
              Number(e.precio) ||
              0) *
              (Number(e.cantidad) || 1),
          0
        )

        return (
          <Fragment key={key}>
            <div
              className="rounded p-3 mb-2"
              style={{
                background: '#e8ecf1',
                cursor: 'pointer',
                borderLeft: `6px solid ${loteColors[loteNombre] || '#999'}`,
              }}
              onClick={() => setOpenKey(prev => (prev === key ? null : key))}
            >
              <h5 className="fw-bold m-0 text-primary">{eventoNombre}</h5>
              <div className="text-muted small">🎟 {loteNombre}</div>
              <div className="small mt-1">
                {totalEntradas} entradas • ${totalMonto}
              </div>
            </div>

            {isOpen &&
              entradas.map(e => {
                const precioUnitario =
                  Number(e.precioUnitario) ||
                  Number(e.lote?.precio) ||
                  Number(e.precio) ||
                  0

                const total = precioUnitario * (Number(e.cantidad) || 1)

                return (
                  <div
                    key={e.id}
                    className="shadow-sm p-2 mb-2 rounded d-flex justify-content-between"
                    style={{
                      background: '#fff',
                      borderLeft: `4px solid ${
                        loteColors[
                          e.lote?.nombre || e.loteNombre || 'Entrada general'
                        ] || '#999'
                      }`,
                    }}
                  >
                    <div>
                      <strong>{e.usuarioNombre}</strong>
                      <div className="small text-muted">
                        x{e.cantidad} • ${total}
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleAprobar(e)}
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRechazar(e)}
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
