// --------------------------------------------------------------
// src/components/admin/EntradasPendientes.jsx — PREMIUM 2025 DEBUG
// --------------------------------------------------------------
import { useEffect, useState, Fragment, useMemo } from 'react'
import {
  escucharEntradasPendientes,
  aprobarEntrada,
  rechazarEntrada,
} from '../../services/entradasAdmin.js'
import Swal from 'sweetalert2'
import {
  swalConfirmDanger,
  swalConfirmWarning,
  swalError,
  swalSuccess,
} from '../../utils/swalUtils'

import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../Firebase'

// --------------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------------
function haceCuanto(valor) {
  if (!valor) return null

  let fecha

  // ✅ Firestore Timestamp
  if (typeof valor.toDate === 'function') {
    fecha = valor.toDate()
  }
  // ✅ ISO string
  else if (typeof valor === 'string') {
    fecha = new Date(valor)
  }
  // ❌ Desconocido
  else {
    console.warn('⛔ Fecha inválida en haceCuanto():', valor)
    return null
  }

  const diffMs = Date.now() - fecha.getTime()
  const min = Math.floor(diffMs / 60000)

  if (min < 1) return 'recién'
  if (min === 1) return 'hace 1 minuto'
  if (min < 60) return `hace ${min} minutos`

  const horas = Math.floor(min / 60)
  if (horas === 1) return 'hace 1 hora'
  return `hace ${horas} horas`
}

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

// --------------------------------------------------------------
// COLORES SEGÚN LOTE
// --------------------------------------------------------------
const loteColors = {
  VIP: '#dc3545',
  General: '#0d6efd',
  'Entrada general': '#0d6efd',
}

function obtenerUltimaModificacionLote(entradas) {
  if (!entradas?.length) return null

  let ultima = null

  entradas.forEach(e => {
    if (!e.ultimaModificacionEn?.toDate) return

    const fecha = e.ultimaModificacionEn.toDate()

    if (!ultima || fecha > ultima.fecha) {
      const diffMin = Math.floor((Date.now() - fecha.getTime()) / 60000)

      ultima = {
        fecha,
        haceCuanto: haceCuanto(e.ultimaModificacionEn),
        por: e.ultimaModificacionPor || 'desconocido',
        minutos: diffMin,
        esReciente: diffMin <= 5, // 🔥 CLAVE
      }
    }
  })

  return ultima
}

// --------------------------------------------------------------
// ORDENADORES
// --------------------------------------------------------------
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
  // 🔥 ESCUCHA REALTIME (LOG CRÍTICO)
  // ------------------------------------------------------------
  useEffect(() => {
    const unsub = escucharEntradasPendientes(data => {
      console.group('📥 ENTRADAS PENDIENTES RECIBIDAS')
      console.log('RAW DATA:', data)

      data?.forEach(e => {
        console.log('➡️ Entrada:', {
          id: e.id,
          ultimaModificacionPor: e.ultimaModificacionPor,
          ultimaModificacionEn: e.ultimaModificacionEn,
          tipoUltimaModificacionEn: typeof e.ultimaModificacionEn,
          tieneToDate:
            e.ultimaModificacionEn &&
            typeof e.ultimaModificacionEn.toDate === 'function',
        })
      })

      console.groupEnd()

      setLista(data || [])
      setLoading(false)
    })

    return () => unsub && unsub()
  }, [])

  // ------------------------------------------------------------
  // ✅ APROBAR
  // ------------------------------------------------------------
  async function handleAprobar(e) {
    console.group('🟢 HANDLE APROBAR')
    console.log('Entrada:', e)
    console.log(
      'Condición modificación:',
      e.ultimaModificacionPor === 'usuario',
      e.ultimaModificacionEn,
      e.ultimaModificacionEn?.toDate
    )
    console.groupEnd()

    if (
      e.ultimaModificacionPor === 'usuario' &&
      e.ultimaModificacionEn?.toDate
    ) {
      const aviso = await Swal.fire({
        icon: 'warning',
        title: 'Entrada modificada recientemente',
        html: `
          El usuario modificó esta entrada
          <strong>${haceCuanto(e.ultimaModificacionEn)}</strong>.
          <br/><br/>
          Verificá que la cantidad y el monto sean correctos antes de aprobar.
        `,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Revisar',
      })

      if (!aviso.isConfirmed) return
    }

    const precioUnitario =
      Number(e.precioUnitario) ||
      Number(e.lote?.precio) ||
      Number(e.precio) ||
      0

    const cantidad = Number(e.cantidad) || 1
    const total = precioUnitario * cantidad
    const nombreLote = e.lote?.nombre || e.loteNombre || 'Entrada general'

    const ok = await swalConfirmWarning({
      title: '¿Aprobar entrada?',
      text: 'Al aprobar la entrada se notificará al Usuario.',
      html: `
        <div style="text-align:left; font-size:14px;">
          <p><b>Usuario:</b> ${e.usuarioNombre}</p>
          <p><b>Evento:</b> ${e.eventoNombre}</p>
          <p><b>Lote:</b> ${nombreLote}</p>
          <p><b>Cantidad:</b> ${cantidad}</p>
          <p><b>Total:</b> <strong>$${total}</strong></p>
        </div>
      `,
    })

    if (!ok.isConfirmed) return

    const entradaNormalizada = {
      ...e,
      precioUnitario,
      lote: e.lote ?? { nombre: nombreLote, precio: precioUnitario },
    }

    const exito = await aprobarEntrada(entradaNormalizada)
    if (!exito) return Swal.fire('Error', 'No se pudo aprobar.', 'error')

    Swal.fire('Listo', 'Entrada aprobada.', 'success')
  }

  // ------------------------------------------------------------
  // 🔥 PROCESAR LISTA
  // ------------------------------------------------------------
  const procesada = useMemo(() => {
    const eventos = {}

    lista.forEach(e => {
      const eventoKey = e.eventoId || e.eventoNombre
      const usuarioKey = e.usuarioId
      const loteKey = e.lote?.id || e.lote?.nombre || e.loteNombre || 'general'

      if (!eventos[eventoKey]) {
        eventos[eventoKey] = {
          eventoId: e.eventoId,
          eventoNombre: e.eventoNombre,
          usuarios: {},
        }
      }

      if (!eventos[eventoKey].usuarios[usuarioKey]) {
        eventos[eventoKey].usuarios[usuarioKey] = {
          usuarioId: e.usuarioId,
          usuarioNombre: e.usuarioNombre,
          lotes: {},
        }
      }

      if (!eventos[eventoKey].usuarios[usuarioKey].lotes[loteKey]) {
        eventos[eventoKey].usuarios[usuarioKey].lotes[loteKey] = {
          loteNombre: e.lote?.nombre || e.loteNombre || 'Entrada general',
          cantidad: 0,
          monto: 0,
          entradas: [],
        }
      }

      const cantidad = Number(e.cantidad) || 1
      const precio =
        Number(e.precioUnitario) ||
        Number(e.lote?.precio) ||
        Number(e.precio) ||
        0

      const lote = eventos[eventoKey].usuarios[usuarioKey].lotes[loteKey]

      lote.cantidad += cantidad
      lote.monto += cantidad * precio
      lote.entradas.push(e)
    })

    return Object.values(eventos)
  }, [lista])

  if (loading) return <p>Cargando…</p>

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <div>
      <h4 className="fw-bold mb-3 mt-4">Entradas Pendientes</h4>

      {procesada.map(evento => {
        const isOpen = openKey === evento.eventoId

        return (
          <Fragment key={evento.eventoId}>
            {/* EVENTO */}
            <div
              className="evento-header rounded p-3 mb-2"
              style={{
                background: '#1f2937',
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={() =>
                setOpenKey(prev =>
                  prev === evento.eventoId ? null : evento.eventoId
                )
              }
            >
              <strong>{evento.eventoNombre}</strong>
              <div className="small opacity-75">
                {Object.keys(evento.usuarios).length} usuarios con compras
              </div>
            </div>

            {/* USUARIOS */}
            {Object.values(evento.usuarios).map(usuario => (
              <div
                key={usuario.usuarioId}
                className="border rounded p-2 mb-2 bg-light"
              >
                <strong>{usuario.usuarioNombre}</strong>

                {Object.values(usuario.lotes).map(lote => (
                  <div
                    key={lote.loteNombre}
                    className="d-flex justify-content-between align-items-center mt-2 p-2 rounded"
                    style={{ background: '#fff' }}
                  >
                    <div>
                      <div className="fw-semibold">🎟 {lote.loteNombre}</div>
                      <div className="small text-muted">
                        {lote.cantidad} entradas • ${lote.monto}
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        className="btn swal-btn-confirm swal-btn-adm"
                        onClick={() => handleAprobarLote(lote)}
                      >
                        Aprobar
                      </button>

                      <button
                        className="btn swal-btn-alt swal-btn-adm"
                        id="swal-btn-adm-danger"
                        onClick={() => handleRechazarLote(lote)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}

async function handleAprobarLote(lote) {
  if (!lote?.entradas?.length) return

  const ultimaMod = obtenerUltimaModificacionLote(lote.entradas)
  const ref = lote.entradas[0]

  const confirm = await swalConfirmWarning({
    title: '¿Aprobar lote de entradas?',
    text: 'Al aprobar el lote se notificará al Usuario.',
    html: `
      <div class="swal-lote">

        <div class="swal-lote-header">
          <div class="swal-lote-title">🎟 ${lote.loteNombre}</div>
          <div class="swal-lote-sub">${ref.eventoNombre}</div>
        </div>

        <div class="swal-lote-grid">
          <div class="swal-card info">
            <span>Cantidad</span>
            <strong>${lote.cantidad}</strong>
          </div>

          <div class="swal-card success">
            <span>Monto total</span>
            <strong>$${lote.monto}</strong>
          </div>
        </div>

        <div class="swal-alert-bot swal-card neutral">
          <span>Usuario</span>
          <strong>${ref.usuarioNombre}</strong>
        </div>

        ${
          ultimaMod
            ? `
              <div class="swal-alert ${
                ultimaMod.esReciente ? 'danger' : 'warning'
              }">
                <strong>
                  ${
                    ultimaMod.esReciente
                      ? '🚨 MODIFICACIÓN MUY RECIENTE'
                      : '⚠ Última modificación'
                  }
                </strong>
                <span>
                  ${ultimaMod.haceCuanto} por <b>${ultimaMod.por}</b>
                </span>
              </div>
            `
            : ''
        }

      </div>
    `,
    confirmText: 'Aprobar lote',
  })

  if (!confirm.isConfirmed) return

  const operacionId = crypto.randomUUID()

  for (const entrada of lote.entradas) {
    const precioUnitario =
      Number(entrada.precioUnitario) ||
      Number(entrada.lote?.precio) ||
      Number(entrada.precio) ||
      0

    const entradaNormalizada = {
      ...entrada,
      precioUnitario,
      lote: entrada.lote ?? {
        nombre: lote.loteNombre,
        precio: precioUnitario,
      },

      // 🔥 ESTE CAMPO DISPARA LA NOTIFICACIÓN
      operacionId,
    }

    const ok = await aprobarEntrada(entradaNormalizada)
    if (!ok) {
      return Swal.fire('Error', 'Falló la aprobación del lote.', 'error')
    }
  }

  // 🔔 NOTIFICAR UNA SOLA VEZ POR LOTE
  await addDoc(collection(db, 'notificaciones'), {
    usuarioId: ref.usuarioId,
    tipo: 'entrada_aprobada',
    nombreEvento: ref.eventoNombre,
    cantidad: lote.cantidad,
    operacionId,
    creadoPor: 'admin',
    creadoEn: serverTimestamp(),
    visto: false,
  })

  Swal.fire(
    'Lote aprobado',
    `${lote.cantidad} entradas aprobadas correctamente.`,
    'success'
  )
}

async function handleRechazarLote(lote) {
  if (!lote?.entradas?.length) return

  const ultimaMod = obtenerUltimaModificacionLote(lote.entradas)
  const ref = lote.entradas[0]

  const confirm = await swalConfirmDanger({
    title: 'Rechazar lote de entradas',
    confirmText: 'Rechazar lote',
    html: `
      <div class="swal-lote">

        <div class="swal-lote-header danger">
          <div class="swal-lote-title">🎟 ${lote.loteNombre}</div>
          <div class="swal-lote-sub">${ref.eventoNombre}</div>
        </div>

        <div class="swal-lote-grid">
          <div class="swal-card warning">
            <span>Entradas</span>
            <strong>${lote.cantidad}</strong>
          </div>

          <div class="swal-card success">
            <span>Monto total</span>
            <strong>$${lote.monto}</strong>
          </div>
        </div>

        <div class="swal-alert-bot swal-card neutral">
          <span>Usuario</span>
          <strong>${ref.usuarioNombre}</strong>
        </div>

        ${
          ultimaMod
            ? `
              <div class="swal-alert ${
                ultimaMod.esReciente ? 'danger' : 'warning'
              }">
                <strong>⚠ Última modificación</strong>
                <span>
                  ${ultimaMod.haceCuanto} por <b>${ultimaMod.por}</b>
                </span>
              </div>
            `
            : ''
        }

        <div class="swal-alert danger">
          <strong>Acción irreversible</strong>
          <span>
            Se eliminarán <b>todas</b> las solicitudes del lote.
          </span>
        </div>

      </div>
    `,
  })

  if (!confirm.isConfirmed) return

  for (const entrada of lote.entradas) {
    const ok = await rechazarEntrada(entrada.id)
    if (!ok) {
      swalError({
        title: 'Error',
        text: `Falló el rechazo del lote.`,
      })
    }
  }

  swalSuccess({
    title: 'Lote rechazado',
    text: `Se eliminaron ${lote.cantidad} solicitudes.`,
  })
}
