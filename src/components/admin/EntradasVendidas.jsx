// --------------------------------------------------------------
// src/components/admin/EntradasVendidas.jsx — PREMIUM 2025 ULTRA PRO
// --------------------------------------------------------------
import { useEffect, useState, useMemo, Fragment } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../Firebase.js'

// --------------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------------
function normalizarTexto(str) {
  return (
    str
      ?.trim()
      ?.toLowerCase()
      ?.normalize('NFD')
      ?.replace(/[\u0300-\u036f]/g, '') || ''
  )
}

function normalizarNombreUsuario(nombre = '') {
  if (!nombre) return 'usuario-desconocido'
  const fixes = nombre
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/ï¿½/g, '')
    .replace(/�/g, '')

  return (
    fixes
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim() || 'usuario-desconocido'
  )
}

function colorEvento(index) {
  const hue = (index * 70) % 360
  return `hsl(${hue}, 65%, 45%)`
}

// --------------------------------------------------------------
// EXPORT CSV
// --------------------------------------------------------------
function CSVExport(nombreEvento, data) {
  let csv =
    'usuario,dni,lote,cantidad,precio,total,estado,fecha_compra,fecha_uso\n'

  data.forEach(e => {
    const creado = e.creadoEn?.seconds
      ? new Date(e.creadoEn.seconds * 1000).toLocaleString('es-AR')
      : '-'

    const usado = e.usadoEn?.seconds
      ? new Date(e.usadoEn.seconds * 1000).toLocaleString('es-AR')
      : '-'

    csv += `${e.usuarioNombre || '-'},${e.dni || '-'},${e.loteNombre || '-'},${
      e.cantidad
    },${e.precio},${e.cantidad * e.precio},${
      e.usado ? 'usada' : 'no usada'
    },${creado},${usado}\n`
  })

  const total = data.reduce((a, e) => a + e.precio * e.cantidad, 0)
  csv += `\nTOTAL DEL EVENTO:, , , , ,${total}\n`

  const compradores = new Set(data.map(e => e.usuarioNombre)).size
  csv += `Comprado por:, , , , ,${compradores} usuarios\n`

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `entradas_${nombreEvento}.csv`
  link.click()
}

// --------------------------------------------------------------
// COMPONENTE
// --------------------------------------------------------------
export default function EntradasVendidas() {
  const [entradas, setEntradas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [openEvent, setOpenEvent] = useState(null)

  // FIRESTORE
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'entradas'), snap => {
      setEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  // PROCESADO
  const eventosLista = useMemo(() => {
    let arr = [...entradas]

    const b = normalizarTexto(busqueda)
    if (b !== '') {
      arr = arr.filter(
        e =>
          normalizarTexto(e.usuarioNombre).includes(b) ||
          normalizarTexto(e.nombreEvento).includes(b)
      )
    }

    if (filtroEstado === 'usada') arr = arr.filter(e => e.usado)
    if (filtroEstado === 'sin-usar') arr = arr.filter(e => !e.usado)

    const eventos = {}
    arr.forEach(e => {
      const evento = e.nombreEvento || 'Evento sin nombre'
      const userKey = normalizarNombreUsuario(e.usuarioNombre)

      if (!eventos[evento]) eventos[evento] = {}
      if (!eventos[evento][userKey])
        eventos[evento][userKey] = {
          nombreReal: e.usuarioNombre?.trim() || 'Usuario',
          tickets: [],
        }

      eventos[evento][userKey].tickets.push(e)
    })

    return Object.entries(eventos)
  }, [entradas, busqueda, filtroEstado])

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div>
      <h4 className="fw-bold mb-3 mt-4">Entradas Vendidas / Aprobadas</h4>

      {/* BUSQUEDA */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Buscar usuario o evento…"
          value={busqueda}
          style={{ maxWidth: 260 }}
          onChange={e => setBusqueda(e.target.value)}
        />

        <select
          className="form-select"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="sin-usar">Sin usar</option>
          <option value="usada">Usadas</option>
        </select>
      </div>

      {/* EVENTOS */}
      {eventosLista.map(([evento, users], idx) => {
        const isOpen = openEvent === evento
        const col = colorEvento(idx)

        const allTickets = Object.values(users).flatMap(u => u.tickets)
        const totalMonto = allTickets.reduce((a, e) => {
          const precio =
            Number(e.precioUnitario) ||
            Number(e.lote?.precio) ||
            Number(e.precio) ||
            0
          return a + precio
        }, 0)
        const unidades = allTickets.length
        const compradores = Object.keys(users).length

        const usadas = allTickets.filter(t => t.usado).length
        const sinUsar = allTickets.filter(t => !t.usado).length

        return (
          <Fragment key={evento}>
            {/* HEADER EVENTO */}
            <div
              className="rounded p-3 mb-2"
              style={{
                background: '#eef2f5',
                cursor: 'pointer',
                borderLeft: `6px solid ${col}`,
              }}
              onClick={() => setOpenEvent(isOpen ? null : evento)}
            >
              <div className="d-flex justify-content-between">
                <strong style={{ color: col, fontSize: '1.1rem' }}>
                  {evento}
                </strong>
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>

              <div style={{ fontSize: '.85rem' }}>
                <b>{allTickets.length}</b> entradas • <b>{unidades}</b> unidades
                • <b>${totalMonto}</b> recaudado
              </div>

              <div
                style={{
                  fontSize: '.78rem',
                  marginTop: 4,
                  color: '#555',
                }}
              >
                {compradores} compradores • {usadas} usadas • {sinUsar} sin usar
              </div>

              <button
                className="btn btn-sm btn-outline-success mt-2"
                onClick={e => {
                  e.stopPropagation()
                  CSVExport(evento, allTickets)
                }}
              >
                Exportar CSV
              </button>
            </div>

            {/* USUARIOS */}
            {isOpen &&
              Object.entries(users)
                .sort((a, b) => {
                  const totalA = a[1].tickets.reduce(
                    (x, t) => x + t.precio * t.cantidad,
                    0
                  )
                  const totalB = b[1].tickets.reduce(
                    (x, t) => x + t.precio * t.cantidad,
                    0
                  )
                  return totalB - totalA
                })
                .map(([key, data]) => {
                  const tickets = data.tickets

                  const totalUser = tickets.reduce((a, e) => {
                    const precio =
                      Number(e.precioUnitario) ||
                      Number(e.lote?.precio) ||
                      Number(e.precio) ||
                      0
                    return a + precio
                  }, 0)

                  const dni = tickets[0]?.dni || '—'
                  const usadas = tickets.filter(t => t.usado).length
                  const sinUsar = tickets.filter(t => !t.usado).length

                  const grupos = Object.entries(
                    tickets.reduce((acc, t) => {
                      const key = `${t.loteNombre}_${t.precio}`
                      if (!acc[key]) {
                        acc[key] = {
                          lote: t.loteNombre,
                          precio: t.precio,
                          cantidad: 0,
                        }
                      }
                      acc[key].cantidad += 1

                      return acc
                    }, {})
                  )

                  return (
                    <div
                      key={key}
                      className="p-3 mb-3 rounded"
                      style={{
                        background: '#ffffff',
                        border: `1px solid ${col}30`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      {/* USUARIO */}
                      <div className="d-flex justify-content-between mb-2">
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: '#111' }}>
                            {data.nombreReal}
                          </strong>

                          <div style={{ fontSize: '.8rem', color: '#555' }}>
                            DNI: <b>{dni}</b>
                          </div>

                          <div style={{ fontSize: '.8rem', color: '#555' }}>
                            Entradas: {tickets.length} ( {usadas} usadas /{' '}
                            {sinUsar} sin usar )
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            className="fw-bold"
                            style={{ fontSize: '1.05rem', color: '#000' }}
                          >
                            Total pagado: ${totalUser}
                          </div>
                        </div>
                      </div>

                      {/* TICKETS AGRUPADOS */}
                      <div className="d-flex flex-column gap-2 mt-2">
                        {grupos.map(([gkey, g]) => {
                          const total = g.precio * g.cantidad
                          return (
                            <div
                              key={gkey}
                              className="px-3 py-2 rounded d-flex justify-content-between align-items-center"
                              style={{
                                background: '#f7f9fb',
                                borderLeft: `4px solid ${col}`,
                                fontSize: '.9rem',
                              }}
                            >
                              <div>
                                <div
                                  style={{ fontSize: '.78rem', color: '#555' }}
                                >
                                  {g.lote} • x{g.cantidad}
                                </div>

                                <div
                                  className="fw-bold"
                                  style={{
                                    color: '#198754',
                                    fontSize: '.95rem',
                                  }}
                                >
                                  +${total}
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
