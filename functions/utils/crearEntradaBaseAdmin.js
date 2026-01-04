// functions/utils/crearEntradaBaseAdmin.js
const admin = require('firebase-admin')

const db = admin.firestore()

/**
 * Crea una entrada normalizada en Firestore (BACKEND)
 */
async function crearEntradaBaseAdmin({
  usuarioId,
  usuarioNombre,

  evento,
  lote = null,

  metodo = 'free',
  precioUnitario = 0,
  cantidad = 1,
  estado = 'aprobado',
  qr = '',

  usado = false,
  loteIndice = null,
}) {
  if (!usuarioId) throw new Error('usuarioId requerido')
  if (!evento?.id) throw new Error('evento inválido')
  if (!evento?.fechaInicio) throw new Error('evento.fechaInicio requerido')

  const eventoSnapshot = {
    eventoId: evento.id,
    nombreEvento: evento.nombre || '',
    lugar: evento.lugar || '',
    fechaEvento: evento.fechaInicio,
    horaInicio: evento.horaInicio || '',
    horaFin: evento.horaFin || '',
  }

  const loteSnapshot = lote
    ? {
        id: lote.id ?? lote.index ?? null,
        nombre: lote.nombre || '',
        descripcion: lote.descripcion || '',
        genero: lote.genero || 'todos',
        incluyeConsumicion: !!lote.incluyeConsumicion,
        desdeHora: lote.desdeHora || '',
        hastaHora: lote.hastaHora || '',
        precio: Number(precioUnitario) || 0,
      }
    : null

  const entrada = {
    usuarioId,
    usuarioNombre: usuarioNombre || '',

    ...eventoSnapshot,

    lote: loteSnapshot,
    loteIndice: Number.isFinite(loteIndice) ? loteIndice : null,

    metodo,
    precioUnitario: Number(precioUnitario) || 0,
    cantidad: Number(cantidad) || 1,
    total: Number(precioUnitario) * Number(cantidad),

    estado,
    usado: !!usado,

    qr: qr || '',

    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  }

  return await db.collection('entradas').add(entrada)
}

module.exports = { crearEntradaBaseAdmin }
