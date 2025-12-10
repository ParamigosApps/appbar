// --------------------------------------------------------------
// entradasGratis.js — FREE CON LOTE + FREE SIN LOTE
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../../Firebase'

// --------------------------------------------------------------
// FREE — Evento con lote seleccionado
// --------------------------------------------------------------
export async function pedirEntradaFreeConLote({
  evento,
  loteSel,
  usuarioId,
  usuarioNombre,
  mostrarQrReact,
  cargarEntradasUsuario,
}) {
  const cant = await Swal.fire({
    title: evento.nombre,
    html: `
      <p>Entrada gratuita (${loteSel.nombre})</p>
      <input id="free-lote" type="number" class="swal2-input"
             min="1" max="${loteSel.restantes}" value="1">
    `,
    showCancelButton: true,
    confirmButtonText: 'Solicitar',
    preConfirm: () => {
      const v = Number(document.getElementById('free-lote').value)
      if (!v || v < 1) return Swal.showValidationMessage('Cantidad inválida')
      if (v > loteSel.restantes)
        return Swal.showValidationMessage(`Máximo ${loteSel.restantes}`)
      return v
    },
  }).then(r => (r.isConfirmed ? r.value : null))

  if (!cant) return

  const ids = []

  for (let i = 0; i < cant; i++) {
    const ref = await addDoc(collection(db, 'entradas'), {
      eventoId: evento.id,
      usuarioId,
      usuarioNombre,
      fecha: evento.fecha,
      lugar: evento.lugar,
      nombreEvento: evento.nombre,
      pagado: true,
      precio: 0,
      cantidad: 1,
      creadoEn: new Date().toISOString(),
      loteIndice: loteSel.index,
      loteNombre: loteSel.nombre,
      estado: 'aprobada',
      usado: false,
    })
    ids.push(ref.id)
  }

  // Actualiza lista del usuario
  await cargarEntradasUsuario(usuarioId)

  // Mostrar QR solo si es 1
  if (cant === 1 && mostrarQrReact) {
    mostrarQrReact({
      ticketId: ids[0],
      nombreEvento: evento.nombre,
      fecha: evento.fecha,
      lugar: evento.lugar,
      horario: evento.horario,
      precio: 'Entrada gratuita',
    })
  }

  Swal.fire('Entradas generadas', '', 'success')
}

// --------------------------------------------------------------
// FREE — Evento sin lotes
// --------------------------------------------------------------
export async function pedirEntradaFreeSinLote({
  evento,
  usuarioId,
  usuarioNombre,
  maxUser,
  mostrarQrReact,
  cargarEntradasUsuario,
}) {
  const cant = await Swal.fire({
    title: evento.nombre,
    html: `
      <p>Entrada gratuita</p>
      <input id="free-sin" type="number" class="swal2-input"
             min="1" max="${maxUser}" value="1">
    `,
    showCancelButton: true,
    confirmButtonText: 'Solicitar',
    preConfirm: () => {
      const v = Number(document.getElementById('free-sin').value)
      if (!v || v < 1) return Swal.showValidationMessage('Cantidad inválida')
      if (v > maxUser) return Swal.showValidationMessage(`Máximo ${maxUser}`)
      return v
    },
  }).then(r => (r.isConfirmed ? r.value : null))

  if (!cant) return

  const ids = []

  for (let i = 0; i < cant; i++) {
    const ref = await addDoc(collection(db, 'entradas'), {
      eventoId: evento.id,
      usuarioId,
      usuarioNombre,
      fecha: evento.fecha,
      lugar: evento.lugar,
      nombreEvento: evento.nombre,
      pagado: true,
      precio: 0,
      cantidad: 1,
      creadoEn: new Date().toISOString(),
      estado: 'aprobada',
      usado: false,
    })
    ids.push(ref.id)
  }

  await cargarEntradasUsuario(usuarioId)

  if (cant === 1 && mostrarQrReact) {
    mostrarQrReact({
      ticketId: ids[0],
      nombreEvento: evento.nombre,
      fecha: evento.fecha,
      lugar: evento.lugar,
      horario: evento.horario,
      precio: 'Entrada gratuita',
    })
  }

  Swal.fire('Entradas generadas', '', 'success')
}
