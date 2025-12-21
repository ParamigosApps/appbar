import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../Firebase.js'
import { enviarMail } from './mailService'
import { mailLogin } from './mailTemplates'
import { swalEditarPerfil } from '../utils/swalUtils'
import { toastSuccess } from '../utils/toastifyUtils'

export async function editarPerfilUsuario({
  uid,
  nombreActual = '',
  emailActual = '',
  telefono = '',
}) {
  // 🔐 0️⃣ Verificar provider REAL desde Firestore
  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    throw new Error('Usuario no encontrado')
  }

  const { provider } = snap.data()

  // ⛔ Bloquear edición si no es teléfono
  if (provider !== 'phone') {
    return toastSuccess(
      'El nombre y el email provienen de tu proveedor de inicio de sesión y no pueden modificarse.'
    )
  }

  // =================================================
  // 1️⃣ Abrir Swal UI
  // =================================================
  const { value, isConfirmed } = await swalEditarPerfil({
    nombreActual,
    emailActual,
    telefono,
  })

  if (!isConfirmed || !value) return null

  // 🔒 Normalizar email
  const emailNuevo = value.email || null

  // 2️⃣ Email anterior real
  const emailAnterior = snap.data().email || null

  // 3️⃣ Guardar en Firestore
  await setDoc(
    ref,
    {
      nombre: value.nombre,
      nombreConfirmado: true,
      email: emailNuevo,
      emailConfirmado: Boolean(emailNuevo),
    },
    { merge: true }
  )

  // 4️⃣ Enviar mail SOLO si se agregó o cambió
  if (emailNuevo && emailNuevo !== emailAnterior) {
    await enviarMail({
      to: emailNuevo,
      subject: '📩 Email registrado correctamente | AppBar',
      html: mailLogin({
        nombre: value.nombre,
        provider: 'perfil',
      }),
    })
  }

  toastSuccess('Perfil actualizado')

  return {
    nombre: value.nombre,
    email: emailNuevo,
  }
}
