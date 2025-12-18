import Swal from 'sweetalert2'
import { generarQrEntradaPayload } from '../../services/generarQrService.js'
import { crearEntradaBase } from '../../services/crearEntradaBase.js'

// --------------------------------------------------------------
// Normaliza cantidad desde abrirResumenLote()
// --------------------------------------------------------------
function normalizarCantidad(cantidad, max = 9999) {
  let v = Number(cantidad)
  if (!Number.isFinite(v) || v < 1) v = 1
  if (v > max) v = max
  return v
}

// ======================================================================
// FREE — EVENTO CON LOTE
// 1 entrada = 1 QR = 1 documento
// ======================================================================
export async function pedirEntradaFreeConLote({
  evento,
  loteSel,
  usuarioId,
  usuarioNombre,
  cantidadSel,
  cargarEntradasUsuario,
  mostrarQrAlGenerar = false,
}) {
  const maxPermitido = Number(loteSel.restantes || 0)

  if (maxPermitido <= 0) {
    return Swal.fire('Sin cupos', 'Este lote ya no tiene lugares.', 'info')
  }
  const operacionId = crypto.randomUUID()
  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)
  const generadas = []

  for (let i = 0; i < cantidad; i++) {
    const qrPayload = {
      tipo: 'entrada',
      eventoId: evento.id,
      usuarioId,
      loteId: loteSel.id ?? loteSel.index ?? null,
      n: i + 1,
    }

    const qrData = generarQrEntradaPayload(qrPayload)

    const ref = await crearEntradaBase({
      usuarioId,
      usuarioNombre,
      evento,

      metodo: 'free',
      precioUnitario: 0,

      lote: {
        id: loteSel?.id ?? null,
        nombre: loteSel?.nombre ?? 'Entrada general',
      },

      cantidad: 1,
      estado: 'aprobada',
      aprobadaPor: 'sistema',
      operacionId,
      qr: qrData,
    })

    generadas.push({ id: ref.id, qr: qrData })

    if (mostrarQrAlGenerar) {
      console.log('🔍 QR generado:', qrData)
    }
  }

  await cargarEntradasUsuario(usuarioId)

  const res = await Swal.fire({
    title: cantidad === 1 ? '¡Entrada generada!' : '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;text-align:center;">
        ${cantidad} entrada(s) para <b>${evento.nombre}</b> 🎟️
      </p>
    `,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'Ir a Mis Entradas',
    cancelButtonText: 'Seguir en eventos',
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel',
    },
    buttonsStyling: false,
    timerProgressBar: true,
    timer: 3500,
  })

  if (res.isConfirmed) {
    document.dispatchEvent(new Event('abrir-mis-entradas'))
  }

  return generadas
}

// ======================================================================
// FREE — EVENTO SIN LOTES
// ======================================================================
export async function pedirEntradaFreeSinLote({
  evento,
  usuarioId,
  usuarioNombre,
  maxUser,
  cantidadSel,
  cargarEntradasUsuario,
}) {
  const maxPermitido = Number(maxUser || 0)

  if (maxPermitido <= 0) {
    return Swal.fire('Sin cupos', 'No tenés cupos disponibles.', 'info')
  }

  const operacionId = crypto.randomUUID()

  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)
  const generadas = []

  for (let i = 0; i < cantidad; i++) {
    const qrPayload = {
      tipo: 'entrada',
      eventoId: evento.id,
      usuarioId,
      n: i + 1,
    }

    const qrData = generarQrEntradaPayload(qrPayload)

    const ref = await crearEntradaBase({
      usuarioId,
      usuarioNombre,
      evento,
      lote: null,
      metodo: 'free',
      precioUnitario: 0,
      cantidad: 1,
      estado: 'aprobada',
      aprobadaPor: 'sistema',
      operacionId,
      qr: qrData,
    })

    generadas.push({ id: ref.id, qr: qrData })
  }

  await cargarEntradasUsuario(usuarioId)

  const fin = await Swal.fire({
    title: cantidad === 1 ? '¡Entrada generada!' : '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;text-align:center;">
        ${cantidad} entrada(s) para <b>${evento.nombre}</b> 🎟️
      </p>
    `,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'Ir a Mis Entradas',
    cancelButtonText: 'Seguir en eventos',
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel',
    },
    buttonsStyling: false,
    timer: 3500,
    timerProgressBar: true,
  })
  if (fin.isConfirmed) {
    document.dispatchEvent(new Event('abrir-mis-entradas'))
  }
  return generadas
}
