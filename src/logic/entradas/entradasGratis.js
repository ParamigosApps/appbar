import Swal from 'sweetalert2'

import { calcularCuposEvento } from '../entradas/entradasEventos.js'
import { showLoading, hideLoading } from '../../services/loadingService.js'

import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../Firebase.js'

function normalizarCantidad(cantidad, max = 9999) {
  let v = Number(cantidad)
  if (!Number.isFinite(v) || v < 1) v = 1
  if (v > max) v = max
  return v
}

export async function pedirEntradaFreeConLote({
  evento,
  loteSel,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  cantidadSel,
}) {
  if (!loteSel) {
    return Swal.fire('Error', 'Lote inválido.', 'error')
  }

  // 🔒 Validación UI (ANTI UX MALA, no seguridad)
  const { maxUser, lotesInfo } = await calcularCuposEvento(evento.id, usuarioId)

  const loteIndex = Number.isFinite(loteSel.index)
    ? loteSel.index
    : Number.isFinite(loteSel.loteIndice)
    ? loteSel.loteIndice
    : null

  const loteActual = lotesInfo.find(l => l.index === loteIndex)

  if (!loteActual || loteActual.restantes <= 0) {
    return Swal.fire('Sin cupos', 'Este lote no tiene disponibilidad.', 'info')
  }

  const maxPermitido = Math.min(loteActual.restantes, maxUser)
  const cantidad = normalizarCantidad(cantidadSel, maxPermitido)

  if (cantidad <= 0) {
    return Swal.fire('Límite alcanzado', 'No tenés cupos.', 'info')
  }

  try {
    // 👉 1️⃣ CREAR DOC (SOLO FIRESTORE)
    await addDoc(collection(db, 'entradasGratisPendientes'), {
      eventoId: evento.id,
      loteIndice: loteIndex,
      cantidad,
      usuarioId,
      usuarioNombre,
      usuarioEmail,
      creadoEn: serverTimestamp(),
      origen: 'frontend',
    })

    // 👉 2️⃣ CERRAR LOADING ANTES DE CUALQUIER UI
    hideLoading()

    // 👉 3️⃣ AHORA SÍ UI
    await Swal.fire({
      icon: 'success',
      title: 'Entradas en proceso',
      html: `
      <p style="font-size:16px;text-align:center;">
        Tus <b>${cantidad}</b> entrada(s) para <b>${evento.nombre}</b>
        se están generando.<br/>
        Las recibirás por mail y en <b>Mis Entradas</b> 🎟️
      </p>
    `,
      confirmButtonText: 'Ir a Mis Entradas',
      customClass: { confirmButton: 'swal-btn-confirm' },
      buttonsStyling: false,
    })

    document.dispatchEvent(new Event('abrir-mis-entradas'))
  } catch (err) {
    hideLoading()
    console.error('❌ Error solicitando entradas gratis', err)

    Swal.fire(
      'Error',
      'No se pudieron procesar las entradas. Intentá nuevamente.',
      'error'
    )
  }
}

export async function pedirEntradaFreeSinLote({
  evento,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  cantidadSel,
}) {
  const { maxUser } = await calcularCuposEvento(evento.id, usuarioId)

  const cantidad = normalizarCantidad(cantidadSel, maxUser)

  if (cantidad <= 0) {
    return Swal.fire('Sin cupos', 'No tenés cupos disponibles.', 'info')
  }

  showLoading({
    title: 'Generando entradas',
    text: 'Estamos procesando tus entradas gratuitas…',
  })

  try {
    await addDoc(collection(db, 'entradasGratisPendientes'), {
      eventoId: evento.id,
      loteIndice: null,
      cantidad,
      usuarioId,
      usuarioNombre,
      usuarioEmail,
      creadoEn: serverTimestamp(),
      origen: 'frontend',
    })

    hideLoading()

    await Swal.fire({
      icon: 'success',
      title: 'Entradas en proceso',
      html: `
        <p style="font-size:16px;text-align:center;">
          Tus <b>${cantidad}</b> entrada(s) para <b>${evento.nombre}</b>
          se están generando.<br/>
          Las recibirás por mail y en <b>Mis Entradas</b> en unos instantes 🎟️
        </p>
      `,
      confirmButtonText: 'Ir a Mis Entradas',
      customClass: { confirmButton: 'swal-btn-confirm' },
      buttonsStyling: false,
    })

    document.dispatchEvent(new Event('abrir-mis-entradas'))
  } catch (err) {
    hideLoading()
    console.error(err)
    Swal.fire(
      'Error',
      'No se pudieron procesar las entradas. Intentá nuevamente.',
      'error'
    )
  }
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

  await Promise.all(
    entradasGratisPendientes.map(g => {
      if (g.lote) {
        return pedirEntradaFreeConLote({
          evento,
          loteSel: g.lote,
          usuarioId,
          usuarioNombre,
          usuarioEmail,
          cantidadSel: g.cantidad,
        })
      }

      return pedirEntradaFreeSinLote({
        evento,
        usuarioId,
        usuarioNombre,
        usuarioEmail,
        cantidadSel: g.cantidad,
      })
    })
  )
}
