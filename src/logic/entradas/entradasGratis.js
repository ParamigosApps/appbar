import Swal from 'sweetalert2'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../Firebase.js'
import { generarQrEntradaPayload } from '../../services/generarQrService.js'

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
// FREE — EVENTO CON LOTE (1 entrada = 1 QR = 1 documento)
// ======================================================================
export async function pedirEntradaFreeConLote({
  evento,
  loteSel,
  usuarioId,
  usuarioNombre,
  cantidadSel,
  cargarEntradasUsuario,
  mostrarQrAlGenerar = false, // NUEVO FLAG
}) {
  console.log('🟦 pedirEntradaFreeConLote()', {
    eventoId: evento.id,
    lote: loteSel.nombre,
    usuarioId,
    cantidadSel,
  })

  const maxPermitido = Number(loteSel.restantes || 0)
  if (maxPermitido <= 0) {
    return Swal.fire('Sin cupos', 'Este lote ya no tiene lugares.', 'info')
  }

  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)
  const generadas = []

  for (let i = 0; i < cantidad; i++) {
    const qrPayload = {
      tipo: 'entrada',
      eventoId: evento.id,
      usuarioId,
      loteIndice: loteSel.index,
      n: i + 1,
    }

    const qrData = generarQrEntradaPayload(qrPayload)

    const ref = await addDoc(collection(db, 'entradas'), {
      usuarioId,
      usuarioNombre,

      eventoId: evento.id,
      nombreEvento: evento.nombre,
      fecha: evento.fecha,
      lugar: evento.lugar,

      loteId: loteSel.id ?? loteSel.index ?? null,
      loteNombre: loteSel.nombre,
      genero: loteSel.genero || 'Unisex',
      incluyeConsumicion: !!loteSel.incluyeConsumicion,

      precio: 0,
      metodo: 'free',
      cantidad: 1,

      estado: 'aprobada',
      usado: false,

      qr: qrData, // STRING PARA MIENTRAS QR
      creadoEn: serverTimestamp(),
    })

    generadas.push({ id: ref.id, qr: qrData })

    // Mostrar QR individual si el flag está activado
    if (mostrarQrAlGenerar) {
      console.log('🔍 Mostrar QR al generar:', qrData)
      // Aquí podríamos invocar un modal QR React si querés
    }
  }

  await cargarEntradasUsuario(usuarioId)

  // Swal final
  const res = await Swal.fire({
    title: '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;">
        ${cantidad} entrada(s) para <b>${evento.nombre}</b> fueron generadas 🎟️
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

  if (res.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))

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
  mostrarQrAlGenerar = false, // NUEVO FLAG
}) {
  console.log('🟦 pedirEntradaFreeSinLote()', {
    eventoId: evento.id,
    usuarioId,
    maxUser,
    cantidadSel,
  })

  const maxPermitido = Number(maxUser || 0)
  if (maxPermitido <= 0) {
    return Swal.fire('Sin cupos', 'No tenés cupos disponibles.', 'info')
  }

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

    const ref = await addDoc(collection(db, 'entradas'), {
      usuarioId,
      usuarioNombre,

      eventoId: evento.id,
      nombreEvento: evento.nombre,
      fecha: evento.fecha,
      lugar: evento.lugar,

      precio: 0,
      metodo: 'free',
      cantidad: 1,

      estado: 'aprobada',
      usado: false,

      qr: qrData,
      creadoEn: serverTimestamp(),
    })

    generadas.push({ id: ref.id, qr: qrData })

    if (mostrarQrAlGenerar) {
      console.log('🔍 Mostrar QR al generar:', qrData)
    }
  }

  await cargarEntradasUsuario(usuarioId)

  const res = await Swal.fire({
    title: '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;">
        ${cantidad} entrada(s) para <b>${evento.nombre}</b> fueron generadas 🎟️
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

  if (res.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))

  return generadas
}
