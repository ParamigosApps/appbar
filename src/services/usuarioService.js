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

  const emailAnterior = snap.exists() ? snap.data().email : null

  const emailFinal = emailNuevo ?? emailAnterior ?? null

  // 💾 Guardar perfil
  await setDoc(
    ref,
    {
      uid,
      nombre,
      nombreConfirmado: true,
      email: emailFinal,
      emailConfirmado: Boolean(emailFinal),
      phoneNumber,
      provider,
      creadoEn: serverTimestamp(),
    },
    { merge: true }
  )

  // 📩 Enviar mail SOLO si se agregó o cambió
  if (emailFinal && emailFinal !== emailAnterior) {
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
  }

  return {
    nombre,
    email: emailFinal,
  }
}
