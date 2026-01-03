// --------------------------------------------------------------
// src/logic/entradas/entradasPago.js
// PAGO MP + TRANSFERENCIA — FINAL DEBUG TRACE 2025 (SIN QUITAR NADA)
// --------------------------------------------------------------

import Swal from 'sweetalert2'

import { crearPreferenciaEntrada } from '../../services/mercadopago.js'

import {
  obtenerDatosBancarios,
  obtenerContacto,
  crearSolicitudPendiente,
} from './entradasUtils.js'

import { normalizarPrecio } from '../../utils/utils.js'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../Firebase.js'
import { showLoading, hideLoading } from '../../services/loadingService'
// =============================================================
// HELPERS DEBUG
// =============================================================
function traceId(prefix = 'TRACE') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function safeLocalStorageSet(key, value, trace) {
  try {
    if (typeof window === 'undefined') {
      console.warn(`[${trace}] localStorage no disponible (SSR)`)
      return false
    }
    if (!window.localStorage) {
      console.warn(`[${trace}] window.localStorage no existe`)
      return false
    }

    window.localStorage.setItem(key, String(value))
    const readBack = window.localStorage.getItem(key)
    const ok = readBack === String(value)

    console.log(`[${trace}] localStorage.setItem(${key})`, {
      value,
      readBack,
      ok,
    })

    return ok
  } catch (e) {
    console.error(`[${trace}] ERROR localStorage.setItem(${key})`, e)
    return false
  }
}

// =============================================================
// 🔵 MERCADO PAGO
// =============================================================
export async function manejarMercadoPago({
  evento,
  loteSel,
  usuarioId,
  eventoId,
  usuarioNombre,
  usuarioEmail,
}) {
  const trace = traceId('MP')
  console.log(`[${trace}] [MP][0] INVOCADO`, {
    eventoId,
    usuarioId,
    hasEvento: !!evento,
    hasLoteSel: !!loteSel,
    detallesLen: Array.isArray(loteSel?.detalles) ? loteSel.detalles.length : 0,
  })

  // -----------------------------------------
  // VALIDACIÓN INPUT
  // -----------------------------------------
  if (
    !evento ||
    !eventoId ||
    !usuarioId ||
    !Array.isArray(loteSel?.detalles) ||
    !loteSel.detalles.length
  ) {
    console.warn(`[${trace}] [MP][X] datos inválidos`, {
      evento,
      eventoId,
      usuarioId,
      loteSel,
    })
    return
  }

  try {
    showLoading({
      title: 'Redirigiendo a Mercado Pago',
      text: 'Aguarda unos instantes..',
    })
    console.group(`[${trace}] [MP][1] INPUT SNAPSHOT`)
    console.log('eventoId:', eventoId)
    console.log('usuarioId:', usuarioId)
    console.log('evento.nombre:', evento?.nombre)
    console.log('loteSel:', loteSel)
    console.groupEnd()

    // -----------------------------------------
    // ARMAR ITEMS
    // -----------------------------------------
    console.log(`[${trace}] [MP][2] armando items...`)

    const items = loteSel.detalles.map((d, i) => {
      console.group(`[${trace}] [MP][2.${i}] detalle`)
      console.log('RAW detalle:', d)
      console.log('RAW precio:', d?.precio, typeof d?.precio)
      console.log('RAW cantidad:', d?.cantidad, typeof d?.cantidad)

      const precio = normalizarPrecio(d.precio)
      const cantidad = Number(d.cantidad)

      const precioSeguro = Math.round(Number(precio))
      const cantidadSegura = Number.isFinite(cantidad)
        ? Math.trunc(cantidad)
        : NaN

      console.log('precio (norm):', precio, typeof precio)
      console.log('cantidad (num):', cantidad, typeof cantidad)
      console.log('precioSeguro:', precioSeguro)
      console.log('cantidadSegura:', cantidadSegura)
      console.groupEnd()

      if (!Number.isFinite(precioSeguro) || precioSeguro <= 0) {
        throw new Error(`Precio inválido: ${d.precio}`)
      }

      if (!Number.isInteger(cantidadSegura) || cantidadSegura <= 0) {
        throw new Error(`Cantidad inválida: ${d.cantidad}`)
      }

      return {
        nombre: d.nombre,
        precio: precioSeguro,
        cantidad: cantidadSegura,
      }
    })

    console.log(`[${trace}] [MP][3] items OK`, items)

    // -----------------------------------------
    // TOTAL
    // -----------------------------------------
    const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
    console.log(`[${trace}] [MP][4] total calculado`, { total })

    // -----------------------------------------
    // ENTRADAS GRATIS
    // -----------------------------------------
    const entradasGratisPendientes = loteSel.detalles
      .filter(d => normalizarPrecio(d.precio) === 0)
      .map(d => ({
        lote: {
          id: loteSel.id ?? 'general',
          nombre: d.nombre,
        },
        cantidad: Number(d.cantidad),
      }))

    console.log(`[${trace}] [MP][5] entradasGratisPendientes`, {
      count: entradasGratisPendientes.length,
      entradasGratisPendientes,
    })

    // -----------------------------------------
    // CREAR PAGO EN FIRESTORE
    // -----------------------------------------
    console.log(`[${trace}] [MP][6] addDoc(/pagos) START`)

    const payloadPago = {
      metodo: 'mp',
      estado: 'pendiente',

      usuarioId,
      usuarioNombre: usuarioNombre || '',
      usuarioEmail: usuarioEmail || '',
      eventoId,
      itemsSolicitados: items,
      total,

      entradasGratisPendientes,
      gratisEntregadas: false,

      createdAt: serverTimestamp(),
      paymentStartedAt: serverTimestamp(),
    }

    console.log(`[${trace}] [MP][6.1] payloadPago`, payloadPago)

    const pagoRef = await addDoc(collection(db, 'pagos'), payloadPago)

    const pagoId = pagoRef.id

    safeLocalStorageSet('pagoIdEnProceso', pagoId, trace)
    console.log(`[${trace}] [MP][7] pago creado OK`, { pagoId })

    // -----------------------------------------
    // CREAR PREFERENCIA MP
    // -----------------------------------------
    console.log(`[${trace}] [MP][8] crearPreferenciaEntrada START`, {
      eventoId,
      pagoId,
      itemsLen: items.length,
    })
    console.log(`CACA [${trace}] [MP][8.0] user data`, {
      usuarioId,
      usuarioNombre,
      usuarioEmail,
    })

    const resp = await crearPreferenciaEntrada({
      eventoId,
      pagoId,
      usuarioId,
      usuarioNombre: usuarioNombre || '',
      usuarioEmail: usuarioEmail || '',
      items: items.map(i => ({
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
      })),
      imagenEventoUrl: evento.imagenEventoUrl || evento.imagen || '',
    })

    console.log(`[${trace}] [MP][9] crearPreferenciaEntrada RESP`, resp)

    const url =
      typeof resp === 'string'
        ? resp
        : resp?.init_point || resp?.url || resp?.sandbox_init_point || ''

    console.log(`[${trace}] [MP][9.1] url resuelta`, { url })

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.group(`[${trace}] [MP][X] RESPUESTA INVÁLIDA / SIN init_point`)
      console.log('resp:', resp)
      console.log('items:', items)
      console.groupEnd()
      throw new Error('MP no devolvió init_point')
    }

    // -----------------------------------------
    // LOCALSTORAGE
    // -----------------------------------------
    console.log(`[${trace}] [MP][10] set localStorage pagoIdEnProceso`, {
      pagoId,
    })

    const okLS = safeLocalStorageSet('pagoIdEnProceso', pagoId, trace)
    if (!okLS) {
      console.warn(
        `[${trace}] [MP][10.1] localStorage NO se pudo persistir. Continuo igual.`
      )
    }

    // -----------------------------------------
    // REDIRECCIÓN
    // -----------------------------------------
    console.log(`[${trace}] [MP][11] redirect a MercadoPago`, { url })
    window.location.href = url
  } catch (err) {
    console.error(`[${trace}] [MP][FATAL] flujo interrumpido`, err)

    await Swal.fire({
      title: 'Error',
      text: 'No se pudo iniciar el pago con Mercado Pago.',
      icon: 'error',
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'swal-popup-custom',
        confirmButton: 'swal-btn-confirm',
      },
      buttonsStyling: false,
    })
  } finally {
    hideLoading()
  }
}

// =============================================================
// 🔄 TRANSFERENCIA BANCARIA (SIN CAMBIOS FUNCIONALES; SOLO LOGS)
// =============================================================
export async function manejarTransferencia({
  evento,
  precio,
  cantidadSel,
  loteSel,
  usuarioId,
  usuarioNombre,
  eventoId,
  detallesPagos,
}) {
  const trace = traceId('TR')
  console.log(`[${trace}] [TR][0] INVOCADO`, {
    eventoId,
    usuarioId,
    precio,
    cantidadSel,
    hasEvento: !!evento,
    hasLoteSel: !!loteSel,
    detallesPagosLen: Array.isArray(detallesPagos) ? detallesPagos.length : 0,
  })

  if (
    !evento ||
    !eventoId ||
    !usuarioId ||
    typeof precio !== 'number' ||
    precio <= 0 ||
    !cantidadSel
  ) {
    console.warn(`[${trace}] [TR][X] datos inválidos`, {
      evento,
      precio,
      cantidadSel,
      usuarioId,
      eventoId,
    })
    return
  }

  const lista =
    Array.isArray(detallesPagos) && detallesPagos.length
      ? detallesPagos
      : Array.isArray(loteSel?.detalles) && loteSel.detalles.length
      ? loteSel.detalles
      : null

  if (!lista) {
    console.warn(`[${trace}] [TR][X] sin detalles de lotes`, {
      loteSel,
      detallesPagos,
    })
    return
  }

  try {
    console.log(`[${trace}] [TR][1] lista lotes resuelta`, {
      cantidadLotes: lista.length,
      lista,
    })

    const datos = await obtenerDatosBancarios()
    const contacto = await obtenerContacto()

    console.log(`[${trace}] [TR][2] datos bancarios/contacto`, {
      datos,
      contacto,
    })

    const {
      aliasBanco = '',
      cbuBanco = '',
      nombreBanco = '',
      titularBanco = '',
    } = datos || {}

    const res = await Swal.fire({
      title: `<span class="swal-title-main">Transferencia Bancaria</span>`,
      width: '480px',
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,

      html: `
        <div class="transfer-box">
          <p class="transfer-monto">
            <b>Monto total:</b>
            <span class="transfer-precio">$${precio}</span>
          </p>

          <div class="transfer-datos-dark">
            <div class="dato-line">
              <span class="label">Alias</span>
              <span class="value">${aliasBanco}</span>
            </div>
            <div class="dato-line">
              <span class="label">CBU</span>
              <span class="value">${cbuBanco}</span>
            </div>
            <div class="dato-line">
              <span class="label">Titular</span>
              <span class="value">${titularBanco}</span>
            </div>
            <div class="dato-line">
              <span class="label">Banco</span>
              <span class="value">${nombreBanco}</span>
            </div>
          </div>

          <button id="comprobante-btn" class="method-btn full-btn azul">
            Enviar comprobante por WhatsApp
          </button>

          <button id="copiar-btn" class="method-btn full-btn celeste">
            Copiar ALIAS
          </button>

          <div id="copiado-ok" class="copiado-ok" style="display:none;">
            Alias copiado
          </div>

          <button id="cerrar-btn" class="method-btn full-btn gris">
            Salir
          </button>
        </div>
      `,

      didOpen: () => {
        const copiarBtn = document.getElementById('copiar-btn')
        const compBtn = document.getElementById('comprobante-btn')
        const cerrarBtn = document.getElementById('cerrar-btn')

        if (copiarBtn) {
          copiarBtn.onclick = async () => {
            try {
              await navigator.clipboard.writeText(`${aliasBanco}`)
              const ok = document.getElementById('copiado-ok')
              if (ok) ok.style.display = 'block'
              setTimeout(() => {
                const ok2 = document.getElementById('copiado-ok')
                if (ok2) ok2.style.display = 'none'
              }, 1800)
            } catch (e) {
              console.error(`[${trace}] [TR][X] clipboard error`, e)
            }
          }
        }

        if (compBtn) {
          compBtn.onclick = () => {
            try {
              if (contacto?.whatsappContacto) {
                const msg = encodeURIComponent(
                  `Hola, soy ${usuarioNombre}. Envío comprobante por ${cantidadSel} entrada(s) del evento ${evento.nombre}.`
                )
                window.open(
                  `https://wa.me/${contacto.whatsappContacto}?text=${msg}`,
                  '_blank'
                )
              }
              Swal.close({ isConfirmed: true })
            } catch (e) {
              console.error(`[${trace}] [TR][X] whatsapp open error`, e)
            }
          }
        }

        if (cerrarBtn) {
          cerrarBtn.onclick = () => Swal.close()
        }
      },
    })

    console.log(`[${trace}] [TR][3] Swal resultado`, res)

    if (!res || res.isDismissed) {
      console.log(`[${trace}] [TR][END] cancelado por usuario`)
      return
    }

    console.log(`[${trace}] [TR][4] creando solicitudes pendientes...`)

    for (const d of lista) {
      const loteIndice = Number.isFinite(d?.lote?.index)
        ? d.lote.index
        : Number.isFinite(d?.loteIndice)
        ? d.loteIndice
        : Number.isFinite(d?.loteId)
        ? Number(d.loteId)
        : null

      const payloadPendiente = {
        usuarioId,
        usuarioNombre,

        eventoId,
        eventoNombre: evento.nombre,
        lugar: evento.lugar,
        fechaEvento: evento.fechaInicio,
        horaInicio: evento.horaInicio,
        horaFin: evento.horaFin,

        lote: {
          id: d.lote?.id ?? d.loteId ?? loteIndice ?? 'general',
          nombre: d.nombre ?? d.lote?.nombre ?? 'Entrada general',
          precio: Number(d.precio) || 0,
        },

        loteIndice: loteIndice,

        metodo: 'transferencia',
        precioUnitario: Number(d.precio) || 0,
        cantidad: Number(d.cantidad) || 1,
        total: (Number(d.precio) || 0) * (Number(d.cantidad) || 1),

        estado: 'pendiente',
        ultimaModificacionPor: 'usuario',
        ultimaModificacionEn: serverTimestamp(),
        creadoEn: serverTimestamp(),
      }

      console.log(`[${trace}] [TR][4.1] payloadPendiente`, payloadPendiente)
      await crearSolicitudPendiente(eventoId, usuarioId, payloadPendiente)
    }

    const fin = await Swal.fire({
      title: 'Solicitud enviada',
      html: `
        <p style="font-size:18px;font-weight:600; text-align:center;">
          Tu pago está pendiente de validación.
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
    })

    console.log(`[${trace}] [TR][5] Swal final`, fin)

    if (fin.isConfirmed) {
      document.dispatchEvent(new Event('abrir-mis-entradas'))
    }
  } catch (err) {
    console.error(`[${trace}] [TR][FATAL] error en Transferencia`, err)

    await Swal.fire({
      title: 'Error',
      text: 'No se pudo procesar la transferencia.',
      icon: 'error',
      allowOutsideClick: false,
      allowEscapeKey: false,
    })
  }
}
