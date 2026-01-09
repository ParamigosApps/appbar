// ----------------------------------------------------------
// Firebase.js (React) — Archivo oficial y definitivo
// ----------------------------------------------------------

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// ⚠ Configuración REAL de tu proyecto
const firebaseConfig = {
  apiKey: 'AIzaSyDkQEN7UMAVQQvOmWZjABmVYgVMMC4g9g0',
  authDomain: 'appbar-24e02.firebaseapp.com',
  projectId: 'appbar-24e02',
  storageBucket: 'appbar-24e02.firebasestorage.app',
  messagingSenderId: '339569084886',
  appId: '1:339569084886:web:xxxxxxxxxxxxxxxxxxxxxx',
}

// ----------------------------------------------------------
// 🔥 Inicializar App (PRIMERO)
// ----------------------------------------------------------
const app = initializeApp(firebaseConfig)

// ----------------------------------------------------------
// 📦 Servicios Firebase
// ----------------------------------------------------------
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// ----------------------------------------------------------
// ☁️ Cloud Functions (Callable)
// ----------------------------------------------------------
export const functions = getFunctions(app, 'us-central1')

export default app
