// /api/registrar-pago-pendiente.js

import { db } from '../src/Firebase.js'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const {
      pagoId,
      userId,
      usuarioEmail = '',
      usuarioNombre = '',
    } = req.body || {}

    if (!pagoId || !userId) {
      return res.status(400).json({
        error: 'pagoId y userId son obligatorios',
      })
    }

    const pagoRef = doc(db, 'pagos', pagoId)
    const snap = await getDoc(pagoRef)

    // --------------------------------------------
    // SI YA EXISTE
    // --------------------------------------------
    if (snap.exists()) {
      const data = snap.data()
      const estado = (data.estado || '').toLowerCase()

      if (['aprobado', 'fallido', 'monto_invalido'].includes(estado)) {
        return res.status(200).json({
          ok: true,
          mensaje: 'Pago ya registrado con estado final',
          estado,
        })
      }

      return res.status(200).json({
        ok: true,
        mensaje: 'Pago pendiente ya existente',
        estado: 'pendiente',
      })
    }

    // --------------------------------------------
    // CREAR PAGO PENDIENTE
    // --------------------------------------------
    await setDoc(pagoRef, {
      estado: 'pendiente',
      metodo: 'mp',
      userId,

      usuarioEmail,
      usuarioNombre,

      creadoEn: serverTimestamp(),
      origen: 'redirect_mp',
    })

    return res.status(201).json({
      ok: true,
      mensaje: 'Pago pendiente registrado',
    })
  } catch (error) {
    console.error('❌ registrar-pago-pendiente:', error)

    return res.status(500).json({
      error: 'Error registrando pago pendiente',
    })
  }
}
