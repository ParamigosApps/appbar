import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../Firebase.js'
import { enviarMail } from './mailService'
import { mailLogin } from './mailTemplates'

export async function guardarPerfilUsuario({
  uid,
  nombre,
  emailNuevo = null,
  phoneNumber = null,
  provider = 'phone',
}) {
  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)

  const emailAnterior = snap.exists() ? snap.data().email || null : null

  // 🔑 Email final: prioridad al nuevo, si no conservar el anterior
  const emailFinal =
    emailNuevo && emailNuevo.trim() !== ''
      ? emailNuevo.trim().toLowerCase()
      : emailAnterior

  // 💾 Guardar / actualizar perfil
  await setDoc(
    ref,
    {
      uid,
      nombre,
      nombreConfirmado: true,
      email: emailFinal || null,
      emailConfirmado: Boolean(emailFinal),
      phoneNumber: phoneNumber || null,
      provider,
      actualizadoEn: serverTimestamp(), // ⬅️ no sobrescribimos creadoEn
    },
    { merge: true }
  )

  // 📩 Enviar mail SOLO si:
  // - hay email
  // - y es nuevo o cambió
  if (emailFinal && emailFinal !== emailAnterior) {
    try {
      await enviarMail({
        to: emailFinal,
        subject: '📩 Email registrado correctamente | AppBar',
        html: mailLogin({
          nombre,
          provider,
          telefono: phoneNumber || null,
          uid,
        }),
      })
    } catch (err) {
      console.warn('⚠️ No se pudo enviar mail de confirmación:', err)
    }
  }

  return {
    nombre,
    email: emailFinal,
  }
}
