// --------------------------------------------------------------
// src/logic/entradas/entradasPago.js
// PAGO MP + TRANSFERENCIA — FINAL ESTABLE 2025
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
// =============================================================
// 🔵 MERCADO PAGO
// =============================================================
export async function manejarMercadoPago({
  evento,
  loteSel,
  usuarioId,
  eventoId,
}) {
  if (
    !evento ||
    !eventoId ||
    !usuarioId ||
    !Array.isArray(loteSel?.detalles) ||
    !loteSel.detalles.length
  ) {
    console.warn('⚠️ manejarMercadoPago datos inválidos')
    return
  }

  try {
    // ------------------------------------------------------------
    // LOG GLOBAL — Snapshot entrada
    // ------------------------------------------------------------
    console.group('🧾 manejarMercadoPago() INPUT SNAPSHOT')
    console.log('eventoId:', eventoId)
    console.log('usuarioId:', usuarioId)
    console.log('evento.nombre:', evento?.nombre)
    console.log('loteSel:', loteSel)
    console.groupEnd()

    // ------------------------------------------------------------
    // ARMAR ITEMS (FUENTE ÚNICA DE VERDAD)
    // ------------------------------------------------------------
    const items = loteSel.detalles.map((d, i) => {
      console.group(`🎟️ ITEM MP #${i}`)
      console.log('RAW detalle:', d)
      console.log('RAW precio:', d.precio, typeof d.precio)
      console.log('RAW cantidad:', d.cantidad, typeof d.cantidad)

      const precio = normalizarPrecio(d.precio)
      const cantidad = Number(d.cantidad)

      const precioSeguro = Math.round(Number(precio))
      const cantidadSegura = Number.isFinite(cantidad)
        ? Math.trunc(cantidad)
        : NaN

      console.log('SANITIZADO precioSeguro:', precioSeguro)
      console.log('SANITIZADO cantidadSegura:', cantidadSegura)
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

    // ------------------------------------------------------------
    // CALCULAR TOTAL DEFINITIVO (🔑 CLAVE)
    // ------------------------------------------------------------
    const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

    console.log('💰 TOTAL DEFINITIVO MP:', total)

    // ------------------------------------------------------------
    // ENTRADAS GRATIS
    // ------------------------------------------------------------
    const entradasGratisPendientes = loteSel.detalles
      .filter(d => normalizarPrecio(d.precio) === 0)
      .map(d => ({
        lote: {
          id: loteSel.id ?? 'general',
          nombre: d.nombre,
        },
        cantidad: Number(d.cantidad),
      }))

    // ------------------------------------------------------------
    // CREAR PAGO EN FIRESTORE (YA CON TOTAL CORRECTO)
    // ------------------------------------------------------------
    const pagoRef = await addDoc(collection(db, 'pagos'), {
      metodo: 'mp',
      estado: 'pendiente',

      usuarioId,
      usuarioNombre: evento?.usuarioNombre || '',
      usuarioEmail: evento?.usuarioEmail || '',

      eventoId,

      itemsPagados: items,

      descripcion: items
        .map(i => `${i.cantidad} ${i.nombre} ($${i.precio * i.cantidad})`)
        .join('\n'),

      total, // ✅ COINCIDE CON MP

      entradasGratisPendientes,
      gratisEntregadas: false,

      createdAt: serverTimestamp(),
      paymentStartedAt: serverTimestamp(),
    })

    const pagoId = pagoRef.id

    // ------------------------------------------------------------
    // CREAR PREFERENCIA MP (USA LOS MISMOS ITEMS)
    // ------------------------------------------------------------
    const resp = await crearPreferenciaEntrada({
      eventoId,
      pagoId,
      items: items.map(i => ({
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
      })),
      imagenEventoUrl: evento.imagenEventoUrl || evento.imagen || '',
    })

    console.log('🧩 crearPreferenciaEntrada() RESPUESTA RAW:', resp)

    const url =
      typeof resp === 'string'
        ? resp
        : resp?.init_point || resp?.url || resp?.sandbox_init_point || ''

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.group('❌ MP RESPUESTA INVÁLIDA / SIN init_point')
      console.log('resp:', resp)
      console.log('items enviados:', items)
      console.groupEnd()

      throw new Error('MP no devolvió init_point')
    }

    // ------------------------------------------------------------
    // REDIRIGIR A MP
    // ------------------------------------------------------------
    localStorage.setItem('pagoIdEnProceso', pagoId)
    window.location.href = url
  } catch (err) {
    console.error('❌ Error Mercado Pago:', err)

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
  }
}

// =============================================================
// 🔄 TRANSFERENCIA BANCARIA
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
  if (
    !evento ||
    !eventoId ||
    !usuarioId ||
    typeof precio !== 'number' ||
    precio <= 0 ||
    !cantidadSel
  ) {
    console.warn('⚠️ manejarTransferencia llamado con datos inválidos', {
      evento,
      precio,
      cantidadSel,
      usuarioId,
      eventoId,
    })
    return
  }
  // -----------------------------------------
  // 🧩 Resolver lotes: single-lote o multi-lote
  // -----------------------------------------
  const lista =
    Array.isArray(detallesPagos) && detallesPagos.length
      ? detallesPagos
      : Array.isArray(loteSel?.detalles) && loteSel.detalles.length
      ? loteSel.detalles
      : null

  if (!lista) {
    console.warn('⚠️ manejarTransferencia sin detalles de lotes', {
      loteSel,
      detallesPagos,
    })
    return
  }

  try {
    console.log('🔄 manejarTransferencia()', {
      eventoId,
      usuarioId,
      cantidadSel,
      precio,
      loteSel,
      detallesPagos,
    })

    const datos = await obtenerDatosBancarios()
    const contacto = await obtenerContacto()

    const {
      aliasBanco = '',
      cbuBanco = '',
      nombreBanco = '',
      titularBanco = '',
    } = datos || {}

    // ----------------------------------------------------------
    // SWAL TRANSFERENCIA (BLOQUEANTE)
    // ----------------------------------------------------------
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
        document.getElementById('copiar-btn').onclick = async () => {
          const texto = `${aliasBanco}`

          await navigator.clipboard.writeText(texto)

          const ok = document.getElementById('copiado-ok')
          ok.style.display = 'block'

          setTimeout(() => {
            ok.style.display = 'none'
          }, 1800)
        }

        document.getElementById('comprobante-btn').onclick = () => {
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
        }

        document.getElementById('cerrar-btn').onclick = () => {
          Swal.close()
        }
      },
    })

    // ⛔ CERRADO → NO CREAR SOLICITUD
    if (!res || res.isDismissed) {
      console.log('ℹ️ Transferencia cancelada')
      return
    }

    // ----------------------------------------------------------
    // CREAR SOLICITUDES PENDIENTES (UNA POR LOTE)
    // ----------------------------------------------------------
    for (const d of lista) {
      const loteIndice = Number.isFinite(d?.lote?.index)
        ? d.lote.index
        : Number.isFinite(d?.loteIndice)
        ? d.loteIndice
        : Number.isFinite(d?.loteId)
        ? Number(d.loteId)
        : null

      await crearSolicitudPendiente(eventoId, usuarioId, {
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

        // ✅ FIJO: guardar el calculado
        loteIndice: loteIndice,

        metodo: 'transferencia',
        precioUnitario: Number(d.precio) || 0,
        cantidad: Number(d.cantidad) || 1,
        total: (Number(d.precio) || 0) * (Number(d.cantidad) || 1),

        estado: 'pendiente',
        ultimaModificacionPor: 'usuario',
        ultimaModificacionEn: serverTimestamp(),
        creadoEn: serverTimestamp(),
      })
    }

    // ----------------------------------------------------------
    // SWAL FINAL
    // ----------------------------------------------------------
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

    if (fin.isConfirmed) {
      document.dispatchEvent(new Event('abrir-mis-entradas'))
    }
  } catch (err) {
    console.error('❌ Error en manejarTransferencia:', err)

    await Swal.fire({
      title: 'Error',
      text: 'No se pudo procesar la transferencia.',
      icon: 'error',
      allowOutsideClick: false,
      allowEscapeKey: false,
    })
  }
}
