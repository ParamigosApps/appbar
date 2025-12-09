// ======================================================
// CREAR USUARIO ADMIN TEST — EJECUTAR UNA SOLA VEZ
// ======================================================
import admin from 'firebase-admin'
import { readFileSync } from 'fs'

// ⚠️ PONÉ TU ARCHIVO serviceAccountKey.json ACÁ
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

// Datos del usuario ficticio
const email = 'admin@test.com'
const password = 'Appbar123'
const permisos = {
  productos: true,
  eventos: true,
  qr: true,
  adminTotal: true,
}

async function crearAdminTest() {
  try {
    console.log('Creando usuario de prueba...')

    // 1) Crear usuario en Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: 'Administrador Test',
    })

    console.log('Usuario creado:', userRecord.uid)

    // 2) Crear documento Firestore
    await db.collection('empleados').doc(userRecord.uid).set({
      nombre: 'Administrador Test',
      email,
      usuario: 'adminTest',
      nivel: 'Nivel4',
      permisos,
      creadoEn: new Date().toISOString(),
    })

    console.log('Documento Firestore creado correctamente.')

    console.log('\n🎉 ADMIN TEST CREADO EXITOSAMENTE 🎉\n')
    console.log('Email:', email)
    console.log('Contraseña:', password)
  } catch (error) {
    console.error('Error creando admin:', error)
  }
}

crearAdminTest()
