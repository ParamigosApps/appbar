// functions/generarEntradasPagasMercadoPago.js
const crypto = require('crypto')
const { getAdmin } = require('./firebaseAdmin')
const { descontarCuposArray } = require('./utils/descontarCuposArray')

// --------------------------------------------------
// 🎟️ GENERAR ENTRADAS PAGAS DESDE PAGO APROBADO
// --------------------------------------------------
async function generarEntradasPagasDesdePago(pagoId, pago) {
  console.log('🟦 [PAGAS] generarEntradasPagasDesdePago INICIO', {
    pagoId,
    tipo: pago.tipo,
    estado: pago.estado,
    usuarioId: pago.usuarioId,
    eventoId: pago.eventoId,
    itemsSolicitados: pago.itemsSolicitados,
  })
  if (pago.tipo !== 'entrada') {
    // MODIFICADO
    console.log('🧯 Skip: pago NO es entrada', {
      pagoId,
      tipo: pago.tipo,
      compraId: pago.compraId,
    })
    return
  }
  const admin = getAdmin()
  const db = admin.firestore()
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()

  const pagoRef = db.collection('pagos').doc(pagoId)

  // --------------------------------------------------
  // 🔐 LOCK TRANSACCIONAL (IDEMPOTENCIA FUERTE)
  // --------------------------------------------------
  const lockResult = await db.runTransaction(async tx => {
    const snap = await tx.get(pagoRef)

    if (!snap.exists) {
      throw new Error('Pago inexistente')
    }

    const data = snap.data()

    if (data.entradasPagasGeneradas === true) {
      return { yaGeneradas: true }
    }

    if (
      data.entradasPagasGeneradas === 'procesando' &&
      data.entradasPagasLockAt?.toDate
    ) {
      const lockAge = Date.now() - data.entradasPagasLockAt.toDate().getTime()

      if (lockAge < 2 * 60 * 1000) {
        return { locked: true }
      }
    }

    tx.update(pagoRef, {
      entradasPagasGeneradas: 'procesando',
      entradasPagasLockAt: serverTimestamp,
    })

    return { locked: false }
  })

  if (lockResult?.yaGeneradas || lockResult?.locked) {
    console.log('ℹ️ Entradas ya generadas o lock activo', pagoId)
    return
  }

  const { usuarioId, eventoId } = pago

  const itemsSolicitados =
    Array.isArray(pago.itemsSolicitados) && pago.itemsSolicitados.length
      ? pago.itemsSolicitados
      : Array.isArray(pago.detallesPagos) && pago.detallesPagos.length
      ? pago.detallesPagos
      : []

  if (!usuarioId || !eventoId || itemsSolicitados.length === 0) {
    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: 'Pago inválido (sin itemsSolicitados/detallesPagos)',
      entradasPagasErrorAt: serverTimestamp,
    })
    throw new Error('Pago inválido para generar entradas')
  }

  const eventoSnap = await db.collection('eventos').doc(eventoId).get()

  if (!eventoSnap.exists) {
    throw new Error('Evento inexistente')
  }

  const evento = eventoSnap.data()

  let batch = db.batch()
  let ops = 0

  try {
    // --------------------------------------------------
    // 1) JUNTAR CUPOS A DESCONTAR (SIN CREAR ENTRADAS)
    // --------------------------------------------------
    const cuposADescontar = []

    for (const item of itemsSolicitados) {
      const cantidad = Number(item.cantidad) || 1

      const loteIndice = Number.isFinite(item.loteIndice)
        ? item.loteIndice
        : Number.isFinite(item.index)
        ? item.index
        : null

      if (!Number.isFinite(loteIndice)) {
        await pagoRef.update({
          entradasPagasGeneradas: 'error',
          entradasPagasError: 'Pago inválido (loteIndice faltante)',
          entradasPagasErrorAt: serverTimestamp,
        })
        throw new Error('Pago inválido: loteIndice faltante')
      }

      cuposADescontar.push({
        eventoId,
        loteIndice,
        cantidad,
        usuarioId,
        compraId: pagoId,
      })
    }

    // --------------------------------------------------
    // 2) AGRUPAR CUPOS POR LOTE
    // --------------------------------------------------
    const mapa = {}

    for (const c of cuposADescontar) {
      const key = String(c.loteIndice)
      if (!mapa[key]) mapa[key] = { ...c, cantidad: 0 }
      mapa[key].cantidad += c.cantidad
    }
    console.log('🟦 [PAGAS] DESCONTAR CUPOS (ANTES)', {
      pagoId,
      mapa,
    })

    // --------------------------------------------------
    // 3) DESCONTAR CUPOS (HARD) ANTES DE CREAR ENTRADAS
    // --------------------------------------------------
    for (const c of Object.values(mapa)) {
      await descontarCuposArray({
        eventoId: c.eventoId,
        loteIndice: c.loteIndice,
        cantidad: c.cantidad,
        usuarioId: c.usuarioId,
        compraId: pagoId,
      })
    }
    console.log('🟦 [PAGAS] DESCONTAR CUPOS OK', {
      pagoId,
    })
    // --------------------------------------------------
    // 4) CREAR ENTRADAS (YA CON CUPOS DESCONTADOS)
    // --------------------------------------------------
    for (const item of itemsSolicitados) {
      const cantidad = Number(item.cantidad) || 1
      const precio = Number(item.precio) || 0

      const loteIndice = Number.isFinite(item.loteIndice)
        ? item.loteIndice
        : Number.isFinite(item.index)
        ? item.index
        : null

      for (let i = 0; i < cantidad; i++) {
        const entradaRef = db.collection('entradas').doc()

        const firma = crypto
          .createHash('sha256')
          .update(`${entradaRef.id}|${pagoId}|${eventoId}`)
          .digest('hex')
          .slice(0, 12)

        const qr = `E|${entradaRef.id}|${firma}`

        batch.set(entradaRef, {
          usuarioId,
          usuarioNombre: pago.usuarioNombre || '',
          usuarioEmail: pago.usuarioEmail || '',

          eventoId,
          eventoNombre: evento.nombre || evento.titulo || '',
          lugar: evento.lugar || '',
          fechaEvento: evento.fechaInicio?.toDate
            ? evento.fechaInicio
            : evento.fechaInicio
            ? admin.firestore.Timestamp.fromDate(new Date(evento.fechaInicio))
            : null,

          horaInicio: evento.horaInicio || '',
          horaFin: evento.horaFin || '',

          pagoId,

          lote: {
            id: item.lote?.id ?? null,
            nombre: item.nombre ?? 'Entrada',
            precio,
          },
          loteIndice,

          metodo: 'mp',
          precioUnitario: precio,

          estado: 'pagado',
          aprobadoPor: 'mercadopago',
          usado: false,

          qr,
          creadoEn: serverTimestamp,
        })

        ops++

        if (ops >= 450) {
          await batch.commit()
          batch = db.batch()
          ops = 0
        }
      }
    }

    if (ops > 0) await batch.commit()
    console.log('🟦 [PAGAS] MARCANDO entradasPagasGeneradas = true', {
      pagoId,
    })

    // --------------------------------------------------
    // 5) MARCAR OK
    // --------------------------------------------------
    await pagoRef.update({
      entradasPagasGeneradas: true,
      entradasPagasAt: serverTimestamp,
    })

    console.log('✅ Entradas generadas OK', pagoId)
  } catch (err) {
    console.error('❌ Error generando entradas', err)

    await pagoRef.update({
      entradasPagasGeneradas: 'error',
      entradasPagasError: err.message || 'Error desconocido',
      entradasPagasErrorAt: serverTimestamp,
    })

    throw err
  }
}

module.exports = { generarEntradasPagasDesdePago }
