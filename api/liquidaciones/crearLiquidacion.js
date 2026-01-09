// /api/liquidaciones/crearLiquidacion.js

import { getAdmin } from './_lib/firebaseAdmin.js'

export const config = {
  runtime: 'nodejs',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const { eventoId, usuarioAdmin } = req.body

  if (!eventoId) {
    return res.status(400).json({ ok: false, error: 'eventoId_required' })
  }

  try {
    const admin = getAdmin()
    const db = admin.firestore()
    const now = admin.firestore.FieldValue.serverTimestamp()

    const pagosSnap = await db
      .collection('pagos')
      .where('eventoId', '==', eventoId)
      .where('estado', '==', 'pagado')
      .where('liquidado', '==', false)
      .get()

    if (pagosSnap.empty) {
      return res.status(400).json({
        ok: false,
        error: 'no_pagos_pendientes',
      })
    }

    // 📊 Agregados
    let totalCobrado = 0
    let totalBase = 0
    let totalComision = 0
    const pagosIds = []

    pagosSnap.docs.forEach(doc => {
      const p = doc.data()
      totalCobrado += Number(p.totalCobrado || 0)
      totalBase += Number(p.totalBase || 0)
      totalComision += Number(p.totalComision || 0)
      pagosIds.push(doc.id)
    })

    // 📌 Evento
    const eventoSnap = await db.collection('eventos').doc(eventoId).get()
    const eventoNombre = eventoSnap.exists ? eventoSnap.data().nombre : 'Evento'

    const liquidacionRef = db.collection('liquidaciones').doc()

    await db.runTransaction(async tx => {
      // Crear liquidación
      tx.set(liquidacionRef, {
        eventoId,
        eventoNombre,
        totalCobrado,
        totalBase,
        totalComision,
        cantidadPagos: pagosIds.length,
        pagosIds,
        creadaEn: now,
        creadaPor: usuarioAdmin || 'admin',
        estado: 'cerrada',
      })

      // Marcar pagos
      pagosIds.forEach(pid => {
        tx.update(db.collection('pagos').doc(pid), {
          liquidado: true,
          liquidacionId: liquidacionRef.id,
          liquidadoEn: now,
        })
      })
    })

    return res.status(200).json({
      ok: true,
      liquidacionId: liquidacionRef.id,
      totalCobrado,
      totalBase,
      totalComision,
      cantidadPagos: pagosIds.length,
    })
  } catch (err) {
    console.error('❌ error creando liquidación', err)
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
    })
  }
}
