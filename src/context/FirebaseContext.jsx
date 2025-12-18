// --------------------------------------------------------------
// FirebaseContext.jsx — AUTENTICACIÓN + PERMISOS DE EMPLEADOS
// --------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../Firebase.js'
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'

const FirebaseContext = createContext(null)

export const useFirebase = () => {
  const ctx = useContext(FirebaseContext)
  if (!ctx) {
    throw new Error('useFirebase debe usarse dentro de <FirebaseProvider>')
  }
  return ctx
}

// 🔥 Lista de administradores permitidos (admin general)
const ADMIN_EMAILS = [
  'ivanruiz@ejemplo.com',
  'todovaper@ejemplo.com',
  // agregá los que quieras
]

let recaptchaVerifierGlobal = null

function getOrCreateRecaptchaVerifier() {
  if (recaptchaVerifierGlobal) return recaptchaVerifierGlobal

  recaptchaVerifierGlobal = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
  })

  return recaptchaVerifierGlobal
}

export function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [empleadoData, setEmpleadoData] = useState(null) // 🔥 permisos por Firestore
  const [loading, setLoading] = useState(true)

  // =====================================================
  // 🔵 Verificar admin por email
  // =====================================================
  function evaluarAdmin(usuario, empleado) {
    if (!usuario && !empleado) {
      setIsAdmin(false)
      return
    }

    // 1️⃣ Admin manual
    if (empleado?.manual && empleado?.nivel >= 4) {
      setIsAdmin(true)
      return
    }

    // 2️⃣ Empleado con nivel
    if (empleado?.nivel >= 4) {
      setIsAdmin(true)
      return
    }

    // 3️⃣ Admin por email (fallback)
    if (usuario?.email && ADMIN_EMAILS.includes(usuario.email)) {
      setIsAdmin(true)
      return
    }

    setIsAdmin(false)
  }

  // =====================================================
  // 🔥 Watch de Firebase Auth
  // =====================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)

      let empleado = null

      if (currentUser) {
        empleado = await cargarEmpleadoFirestore(currentUser.uid)
      } else {
        setEmpleadoData(null)
      }

      evaluarAdmin(currentUser, empleado)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // =====================================================
  // 🔥 Cargar permisos del empleado desde Firestore
  // =====================================================
  async function cargarEmpleadoFirestore(uid) {
    try {
      const ref = doc(db, 'empleados', uid)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setEmpleadoData(data)
        return data
      }

      setEmpleadoData(null)
      return null
    } catch (error) {
      console.error('Error cargando empleado:', error)
      setEmpleadoData(null)
      return null
    }
  }

  // =====================================================
  // MÉTODOS DE LOGIN
  // =====================================================
  async function loginGoogle() {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error('Error login Google:', error)
      Swal.fire('Error', 'No se pudo iniciar sesión con Google', 'error')
    }
  }

  async function loginFacebook() {
    try {
      const provider = new FacebookAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error('Error login Facebook:', error)
      Swal.fire('Error', 'No se pudo iniciar sesión con Facebook', 'error')
    }
  }

  async function loginTelefono(numeroEnTexto) {
    try {
      if (!numeroEnTexto) throw new Error('Número vacío')
      const phoneNumber = numeroEnTexto.trim()
      const appVerifier = getOrCreateRecaptchaVerifier()
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        appVerifier
      )
      return confirmationResult
    } catch (error) {
      console.error('Error login teléfono:', error)
      Swal.fire(
        'Error',
        'No se pudo enviar el SMS. Revisá el número y probá de nuevo.',
        'error'
      )
      throw error
    }
  }

  async function logout() {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      Swal.fire('Error', 'No se pudo cerrar sesión', 'error')
    }
  }

  // =====================================================
  // PROVIDER
  // =====================================================
  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        empleadoData, // 🔥 permisos por Firestore
        loginGoogle,
        loginFacebook,
        loginTelefono,
        logout,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  )
}
