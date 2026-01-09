const { onCall } = require('firebase-functions/v2/https')
const { getAdmin } = require('./firebaseAdmin')

// --------------------------------------------------
// 🔐 ASIGNAR CLAIM ADMIN A UN USUARIO
// --------------------------------------------------
exports.setAdminClaim = onCall(async request => {
  const admin = getAdmin()

  // 🔒 Seguridad mínima: solo otro admin puede asignar
  if (!request.auth?.token?.admin) {
    throw new Error('Solo admin puede asignar admins')
  }

  const { uid } = request.data

  if (!uid) {
    throw new Error('UID requerido')
  }

  await admin.auth().setCustomUserClaims(uid, {
    admin: true,
  })

  return {
    ok: true,
    uid,
    admin: true,
  }
})
