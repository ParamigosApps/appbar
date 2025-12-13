// --------------------------------------------------------------
// src/logic/entradas/entradasPago.js
// PAGO MP + TRANSFERENCIA — FINAL ESTABLE 2025
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import { crearPreferenciaEntrada } from '../../services/mpEntradas.js'
import {
  obtenerDatosBancarios,
  obtenerContacto,
  crearSolicitudPendiente,
} from './entradasUtils.js'

// =============================================================
// 🔵 MERCADO PAGO
// =============================================================
export async function manejarMercadoPago({
  evento,
  precio,
  cantidadSel,
  usuarioId,
  eventoId,
}) {
  // 🛑 DEFENSA BÁSICA
  if (!evento || !precio || !cantidadSel || !usuarioId || !eventoId) {
    console.warn('⚠️ manejarMercadoPago llamado con datos incompletos')
    return
  }

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

    // ❌ URL inválida → mostrar error
    if (typeof url !== 'string' || !url.startsWith('http')) {
      console.warn('⚠️ URL inválida Mercado Pago:', url)

      await Swal.fire({
        title: 'Error',
        text: 'No se pudo iniciar Mercado Pago.',
        icon: 'error',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          htmlContainer: 'swal-text-center',
        },
      })
      return
    }

    // 🚀 REDIRECCIÓN REAL
    window.location.href = url
  } catch (err) {
    console.error('❌ Error en manejarMercadoPago:', err)

    await Swal.fire({
      title: 'Error',
      text: 'No se pudo iniciar Mercado Pago.',
      icon: 'error',
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        htmlContainer: 'swal-text-center',
      },
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
}) {
  // 🛑 DEFENSA BÁSICA
  if (!evento || !precio || !cantidadSel || !usuarioId || !eventoId) {
    console.warn('⚠️ manejarTransferencia llamado con datos incompletos')
    return
  }

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
        <span class="transfer-precio">$${precio * cantidadSel}</span>
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
      Copiar ALIAS
    </button>

    <div id="copiado-ok" class="copiado-ok" style="display:none;">
      Alias copiado
    </div>

    <button id="comprobante-btn" class="method-btn full-btn azul">
      Enviar comprobante por WhatsApp
    </button>

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
    // CREAR SOLICITUD PENDIENTE
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
