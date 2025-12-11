// --------------------------------------------------------------
// src/logic/entradas/entradasPago.js — PAGO MP + TRANSFERENCIA (FINAL 2025)
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import { crearPreferenciaEntrada } from '../../services/mpEntradas.js'
import {
  obtenerDatosBancarios,
  obtenerContacto,
  crearSolicitudPendiente,
} from './entradasUtils.js'

// --------------------------------------------------------------
// 🔵 MERCADO PAGO
// --------------------------------------------------------------
export async function manejarMercadoPago({
  evento,
  precio,
  cantidadSel,
  usuarioId,
  eventoId,
}) {
  try {
    console.log('🔵 manejarMercadoPago()', {
      eventoId,
      usuarioId,
      precio,
      cantidadSel,
    })

    const url = await crearPreferenciaEntrada({
      usuarioId,
      eventoId,
      nombreEvento: evento.nombre,
      cantidad: cantidadSel,
      precio,
      imagenEventoUrl: evento.imagenEventoUrl || evento.imagen,
    })

    if (!url) {
      await Swal.fire('Error', 'No se pudo iniciar Mercado Pago.', 'error')
      return
    }

    window.location.href = url
  } catch (err) {
    console.error('❌ Error en manejarMercadoPago:', err)
    Swal.fire('Error', 'No se pudo iniciar Mercado Pago.', 'error')
  }
}

// --------------------------------------------------------------
// 🔄 TRANSFERENCIA — VERSIÓN PREMIUM CELESTE 2025
// --------------------------------------------------------------
export async function manejarTransferencia({
  evento,
  precio,
  cantidadSel,
  loteSel,
  usuarioId,
  usuarioNombre,
  eventoId,
  navigate, // <<<<<< IMPORTANTE PARA REDIRECCIÓN
}) {
  try {
    console.log('🔄 manejarTransferencia()', {
      eventoId,
      usuarioId,
      cantidadSel,
      precio,
      loteSel,
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
    // Swal PREMIUM CELESTE
    // ----------------------------------------------------------
    await Swal.fire({
      title: `<span class="swal-title-main">Transferencia Bancaria</span>`,
      width: '480px',
      html: `
        <div class="transfer-box">
          
          <p class="transfer-monto">
            <b>Monto total:</b> <span class="transfer-precio">$${
              precio * cantidadSel
            }</span>
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

          <button id="copiar-btn" class="method-btn full-btn celeste">
            📋 Copiar datos
          </button>

          <button id="comprobante-btn" class="method-btn full-btn azul">
            📤 Enviar comprobante
          </button>

          <button id="cerrar-btn" class="method-btn full-btn gris">
            Salir
          </button>
        </div>
      `,
      showConfirmButton: false,

      didOpen: () => {
        // COPIAR INFO
        document.getElementById('copiar-btn').onclick = async () => {
          const texto = `Alias: ${aliasBanco}\nCBU: ${cbuBanco}\nTitular: ${titularBanco}\nBanco: ${nombreBanco}`
          await navigator.clipboard.writeText(texto)

          Swal.fire({
            icon: 'success',
            title: 'Datos copiados',
            timer: 1300,
            showConfirmButton: false,
          })
        }

        // ENVIAR COMPROBANTE
        document.getElementById('comprobante-btn').onclick = () => {
          if (contacto?.whatsappContacto) {
            const msg = encodeURIComponent(
              `Hola, soy ${usuarioNombre}. Envío comprobante por ${cantidadSel} entrada(s) del evento ${evento.nombre}.`
            )
            window.open(
              `https://wa.me/${contacto.whatsappContacto}?text=${msg}`
            )
          }
          Swal.close()
        }

        // SALIR
        document.getElementById('cerrar-btn').onclick = () => {
          Swal.close()
        }
      },
    })

    // ----------------------------------------------------------
    // Crear solicitud pendiente
    // ----------------------------------------------------------
    await crearSolicitudPendiente(eventoId, usuarioId, {
      nombre: evento.nombre,
      precio,
      fecha: evento.fecha,
      lugar: evento.lugar,
      horario: evento.horario,
      cantidad: cantidadSel,
      loteIndice: loteSel?.index ?? null,
      loteNombre: loteSel?.nombre ?? null,
      usuarioNombre,
      estado: 'pendiente',
    })

    // ----------------------------------------------------------
    // SWAL FINAL + OPCIÓN IR A MIS ENTRADAS
    // ----------------------------------------------------------
    const fin = await Swal.fire({
      title: 'Solicitud enviada',
      html: `
        <p style="font-size:18px;font-weight:600;">
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
    })

    // 🔥 REDIRECCIÓN REAL
    if (fin.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))
  } catch (err) {
    console.error('❌ Error en manejarTransferencia:', err)
    Swal.fire('Error', 'No se pudo procesar la transferencia.', 'error')
  }
}
