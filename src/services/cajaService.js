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

export async function registrarRetiroCompra({
  compraId,
  compraData,
  empleado,
}) {
  // 1️⃣ Update compra
  await updateDoc(doc(db, 'compras', compraId), {
    retirada: true,
    retiradaEn: serverTimestamp(),
    retiradaPor: {
      uid: empleado.uid,
      nombre: empleado.nombre,
      rol: empleado.rol || 'caja',
    },
    retiroMetodo: 'qr',
  })

  // 2️⃣ Log inmutable
  await addDoc(collection(db, 'logsCaja'), {
    tipo: 'retiro_compra',
    compraId,
    numeroPedido: compraData.numeroPedido,
    total: compraData.total,
    usuarioNombre: compraData.usuarioNombre,
    realizadoPor: {
      uid: empleado.uid,
      nombre: empleado.nombre,
    },
    fecha: serverTimestamp(),
    origen: 'lector_qr',
  })
}

export async function mostrarComprobanteCaja(compra) {
  const {
    numeroPedido,
    estado,
    usuarioNombre,
    lugar,
    carrito,
    total,
    ticketId,
    creadoEn,
  } = compra

  const fechaHumana = creadoEn?.toDate
    ? creadoEn.toDate().toLocaleString()
    : new Date().toLocaleString()

  await Swal.fire({
    title: '🧾 Comprobante de Entrega',
    width: '420px',
    html: `
      <div id="ticketGenerado" style="
        font-size:14px;
        font-family: monospace;
        border:1px dashed #ccc;
        padding:12px;
        background:#fafafa;
      ">
        <div style="text-align:center;margin-bottom:8px;">
          <strong style="font-size:18px">PEDIDO #${numeroPedido}</strong><br>
          <span style="font-size:12px">${fechaHumana}</span>
        </div>

        <hr>

        <p><strong>Cliente:</strong> ${usuarioNombre}</p>
        <p><strong>Lugar:</strong> ${lugar}</p>
        <p><strong>Estado:</strong> ${estado.toUpperCase()}</p>

        <hr>

        ${carrito
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

      <div style="display:flex;gap:10px;margin-top:15px">
        <button id="btnPdf" class="btn btn-dark" style="flex:1">PDF</button>
        <button id="btnWsp" class="btn btn-success" style="flex:1">WhatsApp</button>
      </div>
    `,
    didOpen: async () => {
      await generarCompraQr({
        ticketId,
        contenido: ticketId,
        qrContainer: document.getElementById('qrCompraContainer'),
        tamaño: 180,
      })

      document.getElementById('btnPdf').onclick = async () => {
        const canvas = await html2canvas(
          document.getElementById('ticketGenerado'),
          { scale: 2 }
        )
        const pdf = new jsPDF()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, 180, 0)
        pdf.save(`pedido-${numeroPedido}.pdf`)
      }

      document.getElementById('btnWsp').onclick = () => {
        const msg =
          `🧾 Pedido #${numeroPedido}%0A` +
          `Cliente: ${usuarioNombre}%0A` +
          `Total: $${total}`
        window.open(`https://wa.me/?text=${msg}`, '_blank')
      }
    },
    confirmButtonText: 'Cerrar',
    buttonsStyling: false,
  })
}
