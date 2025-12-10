// --------------------------------------------------------------
// src/logic/entradas/entradasPago.js — PAGO MP + TRANSFERENCIA
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
// 🔄 TRANSFERENCIA
// --------------------------------------------------------------
export async function manejarTransferencia({
  evento,
  precio,
  cantidadSel,
  loteSel,
  usuarioId,
  usuarioNombre,
  eventoId,
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

    const r = await Swal.fire({
      title: 'Transferencia bancaria',
      html: `
        <pre style="background:#111;color:white;padding:10px;border-radius:8px;">
Alias: ${aliasBanco}
CBU: ${cbuBanco}
Banco: ${nombreBanco}
Titular: ${titularBanco}
        </pre>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Enviar comprobante',
      denyButtonText: 'Copiar alias',
    })

    if (r.isDismissed) return

    if (r.isDenied) {
      if (aliasBanco) {
        await navigator.clipboard.writeText(aliasBanco)
        await Swal.fire('Copiado', 'Alias copiado correctamente.', 'success')
      }
      // volver a mostrar info
      return manejarTransferencia({
        evento,
        precio,
        cantidadSel,
        loteSel,
        usuarioId,
        usuarioNombre,
        eventoId,
      })
    }

    if (r.isConfirmed && contacto?.whatsappContacto) {
      const msg = encodeURIComponent(
        `Hola, soy ${usuarioNombre}. Envío comprobante por ${cantidadSel} entrada(s) del evento ${evento.nombre}.`
      )
      window.open(`https://wa.me/${contacto.whatsappContacto}?text=${msg}`)
    }

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
    })

    Swal.fire('Solicitud enviada', '', 'success')
  } catch (err) {
    console.error('❌ Error en manejarTransferencia:', err)
    Swal.fire('Error', 'No se pudo procesar la transferencia.', 'error')
  }
}
