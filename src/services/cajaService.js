import Swal from 'sweetalert2'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../Firebase.js'

import { generarCompraQr } from './generarQrService.js'
export async function registrarRetiroCompra({
  compraId,
  compraData,
  empleado,
  origen = 'qr-caja',
}) {
  if (!compraId) throw new Error('compraId requerido')

  if (compraData.estado !== 'pagado') {
    throw new Error('El pedido debe estar pagado antes de retirarse')
  }

  // 1️⃣ Marcar compra como retirada
  await updateDoc(doc(db, 'compras', compraId), {
    estado: 'retirado',
    retirada: true,
    retiradaEn: serverTimestamp(),
    retiradaDesde: origen,
    retiroMetodo: 'qr',
    retiradaPor: {
      uid: empleado.uid || null,
      nombre: empleado.nombre || 'Caja',
      rol: empleado.rol || 'caja',
    },
  })

  // 2️⃣ Log enriquecido (INMUTABLE)
  await addDoc(collection(db, 'logsCaja'), {
    tipo: 'retiro_compra',
    compraId,
    numeroPedido: compraData.numeroPedido,
    total: compraData.total,
    lugar: compraData.lugar || 'Sin especificar',

    evento: {
      id: compraData.eventoId || null,
      nombre: compraData.eventoNombre || 'Sin evento',
    },

    usuario: {
      id: compraData.usuarioId || null,
      nombre: compraData.usuarioNombre || 'Desconocido',
    },

    realizadoPor: {
      uid: empleado.uid || null,
      nombre: empleado.nombre || 'Caja',
      rol: empleado.rol || 'caja',
    },

    metodo: 'qr',
    origen,
    fecha: serverTimestamp(),
  })
}

export async function registrarPagoCompra({ compraId, compraData, empleado }) {
  if (!compraId) throw new Error('compraId requerido')

  await updateDoc(doc(db, 'compras', compraId), {
    estado: 'pagado',
    pagado: true,
    pagadoEn: serverTimestamp(),
    pagadoPor: {
      uid: empleado.uid || null,
      nombre: empleado.nombre || 'Caja',
      rol: empleado.rol || 'caja',
    },
  })

  await addDoc(collection(db, 'logsCaja'), {
    tipo: 'pago_compra',
    compraId,
    numeroPedido: compraData.numeroPedido,
    total: compraData.total,
    usuarioNombre: compraData.usuarioNombre,
    realizadoPor: {
      uid: empleado.uid || null,
      nombre: empleado.nombre || 'Caja',
      rol: empleado.rol || 'caja',
    },
    fecha: serverTimestamp(),
    origen: 'qr-caja',
  })
}

export async function mostrarComprobanteCaja(compra) {
  const {
    numeroPedido,
    estado,
    usuarioNombre,
    lugar,
    carrito,
    items, // por compatibilidad
    total,
    ticketId,
    creadoEn,
  } = compra

  const lista = items || carrito || []

  const fechaHumana = creadoEn?.toDate
    ? creadoEn.toDate().toLocaleString()
    : new Date().toLocaleString()

  await Swal.fire({
    title: '🎫 Ticket de Retiro',
    width: '420px',
    html: `
    <div id="ticketGenerado" style="
      font-size:14px;
      font-family: monospace;
      border:2px dashed #000;
      padding:12px;
      background:#ffffff;
    ">
      <div style="text-align:center;margin-bottom:8px;">
        <strong style="font-size:18px">PEDIDO #${numeroPedido}</strong><br>
        <span style="font-size:12px">${fechaHumana}</span>
      </div>

      <hr>

      <p><strong>Cliente:</strong> ${usuarioNombre}</p>
      <p><strong>Lugar:</strong> ${lugar}</p>

      <p style="margin-top:8px;color:#166534;font-weight:bold">
        ✔ TICKET ENTREGADO AL CLIENTE
      </p>

      <p style="margin-top:6px;color:#92400e;font-weight:bold">
        🍺 Presentar este ticket en la barra para retirar el pedido
      </p>

      <hr>

      ${lista
        .map(
          p => `
        <div style="display:flex;justify-content:space-between">
          <span>${p.nombre} ×${p.enCarrito}</span>
          <span>$${p.precio * p.enCarrito}</span>
        </div>
      `
        )
        .join('')}

      <hr>

      <div style="display:flex;justify-content:space-between;font-size:18px">
        <strong>TOTAL</strong>
        <strong>$${total}</strong>
      </div>

      <div id="qrCompraContainer" style="margin-top:12px;display:flex;justify-content:center"></div>
    </div>

    <div style="margin-top:15px">
      <button id="btnPdf" class="btn btn-dark w-100">Descargar PDF</button>
    </div>
  `,
    didOpen: async () => {
      try {
        await generarCompraQr({
          ticketId,
          contenido: ticketId,
          qrContainer: document.getElementById('qrCompraContainer'),
          tamaño: 160,
        })
      } catch (e) {
        console.error('No se pudo generar QR en comprobante:', e)
      }

      document.getElementById('btnPdf').onclick = async () => {
        const canvas = await html2canvas(
          document.getElementById('ticketGenerado'),
          { scale: 2 }
        )
        const pdf = new jsPDF()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, 180, 0)
        pdf.save(`ticket-pedido-${numeroPedido}.pdf`)
      }
    },
    confirmButtonText: 'Cerrar',
    buttonsStyling: false,
  })
}
