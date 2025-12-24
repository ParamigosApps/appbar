import Swal from 'sweetalert2'
import { crearEntradaBase } from '../../services/crearEntradaBase.js'
import { firmarEntradaCorta } from '../../services/firmarEntrada.js'
import { enviarEntradasPorMail } from '../../services/mailEntradasService.js'
import { updateDoc } from 'firebase/firestore'

import { calcularCuposEvento } from '../entradas/entradasEventos.js'

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
  usuarioEmail,
  cantidadSel,
  cargarEntradasUsuario,
  mostrarQrAlGenerar = false,
  noMostrarSwal = false,
}) {
  if (!loteSel) {
    console.error('❌ pedirEntradaFreeConLote llamado sin loteSel', {
      evento,
      cantidadSel,
    })
    return Swal.fire(
      'Error',
      'No se pudo asignar el lote de la entrada.',
      'error'
    )
  }

  // 🔒 RECALCULAR CUPOS REALES (ANTI FRAUDE)
  const { maxUser, lotesInfo } = await calcularCuposEvento(evento.id, usuarioId)

  const loteIndex = Number.isFinite(loteSel.index)
    ? loteSel.index
    : Number.isFinite(loteSel.loteIndice)
    ? loteSel.loteIndice
    : null

  if (loteIndex === null) {
    return Swal.fire('Error', 'Lote inválido.', 'error')
  }

  const loteActual = lotesInfo.find(l => l.index === loteIndex)

  if (!loteActual || loteActual.restantes <= 0) {
    return Swal.fire(
      'Sin cupos',
      'Este lote ya no tiene disponibilidad.',
      'info'
    )
  }

  // 🔐 límite FINAL
  const maxPermitido = Math.min(loteActual.restantes, maxUser)

  if (maxPermitido <= 0) {
    return Swal.fire(
      'Límite alcanzado',
      'Ya no podés generar más entradas.',
      'info'
    )
  }

  const operacionId = crypto.randomUUID()
  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)
  const generadas = []

  for (let i = 0; i < cantidad; i++) {
    if (i >= maxPermitido) break

    // 1️⃣ Crear entrada SIN QR
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
      loteIndice: loteIndex,
      cantidad: 1,
      estado: 'aprobada',
      aprobadaPor: 'sistema',
      operacionId,
      qr: null, // ⬅️ después lo actualizamos
    })

    // 2️⃣ Firmar con ID real
    const firma = firmarEntradaCorta(ref.id)
    const qrData = `E|${ref.id}|${firma}`

    // 3️⃣ Guardar QR definitivo
    await updateDoc(ref, { qr: qrData })

    generadas.push({ id: ref.id, qr: qrData })

    if (mostrarQrAlGenerar) {
      console.log('🔍 QR generado:', qrData)
    }
  }

  // 🔒 Clonar entradas con QR ANTES de otros awaits
  const entradasParaMail = generadas.map(e => ({
    id: e.id,
    qr: e.qr,
  }))
  await cargarEntradasUsuario(usuarioId)
  console.log(
    '🧪 Payloads para mail:',
    entradasParaMail.map(e => e.qr)
  )
  // --------------------------------------------------------------
  // 📧 ENVIAR MAIL CON QRs (FREE CON LOTE)
  // --------------------------------------------------------------
  try {
    await enviarEntradasPorMail({
      email: usuarioEmail,
      nombre: usuarioNombre,
      evento,
      entradas: entradasParaMail,
    })
  } catch (e) {
    console.warn('⚠️ No se pudo enviar mail de entradas:', e)
  }

  if (noMostrarSwal) {
    return generadas
  }
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
  usuarioEmail,
  cantidadSel,
  cargarEntradasUsuario,
}) {
  const { maxUser: maxUserReal } = await calcularCuposEvento(
    evento.id,
    usuarioId
  )

  const maxPermitido = Number(maxUserReal || 0)

  if (maxPermitido <= 0) {
    return Swal.fire('Sin cupos', 'No tenés cupos disponibles.', 'info')
  }

  const operacionId = crypto.randomUUID()
  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)
  const generadas = []

  // ======================================================
  // ✅ UN SOLO LOOP — 1 entrada = 1 QR = 1 documento
  // ======================================================

  for (let i = 0; i < cantidad; i++) {
    // 1️⃣ Crear entrada SIN QR

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
      qr: null, // ⬅️ se setea después
    })

    // 2️⃣ Firmar con ID real
    const firma = firmarEntradaCorta(ref.id)
    const qrData = `E|${ref.id}|${firma}`

    // 3️⃣ Guardar QR definitivo
    await updateDoc(ref, { qr: qrData })

    generadas.push({ id: ref.id, qr: qrData })
  }

  // ======================================================
  // 📧 MAIL — usar solo QRs ya generados
  // ======================================================
  const entradasParaMail = generadas.map(e => ({
    id: e.id,
    qr: e.qr,
  }))

  await cargarEntradasUsuario(usuarioId)

  try {
    await enviarEntradasPorMail({
      email: usuarioEmail,
      nombre: usuarioNombre,
      evento,
      entradas: entradasParaMail,
    })
  } catch (e) {
    console.warn('⚠️ No se pudo enviar mail de entradas:', e)
  }

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

export async function entregarEntradasGratisPostPago({
  evento,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  entradasGratisPendientes,
  mostrarQrReact,
  cargarEntradasUsuario,
}) {
  if (!Array.isArray(entradasGratisPendientes)) return

  for (const g of entradasGratisPendientes) {
    // 👉 SI TIENE LOTE
    if (g.lote) {
      await pedirEntradaFreeConLote({
        evento,
        loteSel: g.lote,
        usuarioId,
        usuarioNombre,
        usuarioEmail,
        cantidadSel: g.cantidad,
        mostrarQrAlGenerar: mostrarQrReact,
        noMostrarSwal: true,
        cargarEntradasUsuario,
      })
    }
    // 👉 SIN LOTE
    else {
      await pedirEntradaFreeSinLote({
        evento,
        usuarioId,
        usuarioNombre,
        usuarioEmail,
        cantidadSel: g.cantidad,
        cargarEntradasUsuario,
      })
    }
  }
}
