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

// ======================================================
// REGISTRAR ENTREGA DE TICKET AL CLIENTE
// ======================================================
export async function registrarRetiroCompra({
  compraId,
  compraData,
  empleado,
  origen = 'qr-caja',
}) {
  if (!compraId) throw new Error('compraId requerido')

  if (compraData.estado !== 'pagado') {
    throw new Error('El pedido debe estar pagado antes de retirar el ticket')
  }

  // 1️⃣ Marcar compra como RETIRADA (ticket entregado)
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

  // 2️⃣ LOG INMUTABLE — ENTREGA DE TICKET
  await addDoc(collection(db, 'logsCaja'), {
    tipo: 'ticket_entregado_cliente',

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

// ======================================================
// REGISTRAR PAGO EN CAJA
// ======================================================
export async function registrarPagoCompra({ compraId, compraData, empleado }) {
  if (!compraId) throw new Error('compraId requerido')

  await updateDoc(doc(db, 'compras', compraId), {
    estado: 'pagado',
    pagado: true,
    origenPago: 'caja',
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

export async function cancelarPagoCompra({ compraId, compraData, empleado }) {
  if (!compraId) throw new Error('compraId requerido')

  // 🔒 1. Solo pagos de caja
  if (compraData.origenPago !== 'caja') {
    throw new Error('Este pago no puede revertirse (origen externo)')
  }

  // 🔒 2. Solo el mismo empleado
  if (compraData.pagadoPor?.uid !== empleado.uid) {
    throw new Error('Solo el empleado que registró el pago puede cancelarlo')
  }

  // 🔒 3. No permitir si ya fue retirado
  if (compraData.estado === 'retirado') {
    throw new Error('No se puede cancelar un pedido ya retirado')
  }

  // 🔄 Revertir estado
  await updateDoc(doc(db, 'compras', compraId), {
    estado: 'pendiente',
    pagado: false,
    pagadoEn: null,
    pagadoPor: null,
    origenPago: null,
  })

  // 🧾 Log inmutable
  await addDoc(collection(db, 'logsCaja'), {
    tipo: 'cancelacion_pago',
    compraId,
    numeroPedido: compraData.numeroPedido,
    total: compraData.total,

    realizadoPor: {
      uid: empleado.uid,
      nombre: empleado.nombre,
      rol: empleado.rol,
    },

    motivo: 'Cancelación manual de pago en caja',
    fecha: serverTimestamp(),
  })
}
