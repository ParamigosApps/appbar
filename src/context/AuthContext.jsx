// -----------------------------------------------------------
// 📌 AUTH CONTEXT — versión corregida COMPLETA
// -----------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../Firebase.js'

import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
} from 'firebase/auth'

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

import Swal from 'sweetalert2'

// CONTEXTO
const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// -----------------------------------------------------------
// 📌 PROVIDER
// -----------------------------------------------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loginSettings, setLoginSettings] = useState({
    google: true,
    facebook: true,
    phone: true,
  })

  const [loginAbierto, setLoginAbierto] = useState(false)

  // 🌟 FUNCIÓN GLOBAL PARA ABRIR EL LOGIN (usable desde cualquier contexto)
  function abrirLoginGlobal() {
    setLoginAbierto(true)
    document.dispatchEvent(new CustomEvent('abrir-login'))
  }

  function cerrarLoginGlobal() {
    setLoginAbierto(false)
  }

  // ------------------------------------------------------------
  // 📌 Cargar configuración Firestore
  // ------------------------------------------------------------
  async function cargarLoginSettings() {
    try {
      const ref = doc(db, 'configuracion', 'loginMetodos')
      const snap = await getDoc(ref)
      if (snap.exists()) setLoginSettings(snap.data())
    } catch (e) {
      console.error('Error cargando login settings:', e)
    }
  }

  // ------------------------------------------------------------
  // 📌 LOGIN GOOGLE
  // ------------------------------------------------------------
  async function loginGoogle() {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const u = result.user

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          nombre: u.displayName || u.email,
          email: u.email,
          uid: u.uid,
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser(u)
      cerrarLoginGlobal()
    } catch (err) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      )
        return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // ------------------------------------------------------------
  // 📌 LOGIN FACEBOOK
  // ------------------------------------------------------------
  async function loginFacebook() {
    try {
      const provider = new FacebookAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const u = result.user

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          nombre: u.displayName,
          email: u.email || '',
          uid: u.uid,
          provider: 'facebook',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser(u)
      cerrarLoginGlobal()
    } catch (err) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      )
        return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // ------------------------------------------------------------
  // 📌 LOGIN TELÉFONO
  // ------------------------------------------------------------
  let confirmationResult = null

  async function loginTelefonoEnviarCodigo(phone) {
    if (!phone.startsWith('+54')) {
      return Swal.fire('Error', 'El número debe comenzar con +54', 'error')
    }

    try {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        { size: 'invisible' }
      )

      confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier
      )

      Swal.fire('Código enviado', 'Revisa tu SMS', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function loginTelefonoValidarCodigo(code) {
    if (!code) return Swal.fire('Error', 'Ingresá el código', 'error')

    try {
      const result = await confirmationResult.confirm(code)
      const u = result.user

      const { value: nombre } = await Swal.fire({
        title: 'Ingresá tu nombre',
        input: 'text',
        inputValidator: v => (!v ? 'Ingresá un nombre' : null),
      })

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          nombre,
          telefono: u.phoneNumber,
          uid: u.uid,
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser(u)
      cerrarLoginGlobal()
    } catch {
      Swal.fire('Error', 'Código inválido', 'error')
    }
  }

  // ------------------------------------------------------------
  // 📌 LOGOUT
  // ------------------------------------------------------------
  async function logout() {
    await signOut(auth)
    setUser(null)
  }

  // ------------------------------------------------------------
  // 📌 OBSERVAR SESIÓN
  // ------------------------------------------------------------
  useEffect(() => {
    cargarLoginSettings()
    const unsub = onAuthStateChanged(auth, u => setUser(u || null))
    return () => unsub()
  }, [])

  // ------------------------------------------------------------
  // 📌 VALUE DEL CONTEXT (todo lo disponible)
  // ------------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        loginSettings,

        // Métodos de login:
        loginGoogle,
        loginFacebook,
        loginTelefonoEnviarCodigo,
        loginTelefonoValidarCodigo,
        logout,

        // 🔥 Funciones globales:
        abrirLoginGlobal,
        cerrarLoginGlobal,
        loginAbierto,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
