// -----------------------------------------------------------
// 📌 AUTH CONTEXT — versión COMPLETA con ADMIN manual
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
// 📌 ADMIN MANUAL (usuario + contraseña local)
// -----------------------------------------------------------

const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

// -----------------------------------------------------------
// 📌 PROVIDER
// -----------------------------------------------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [rolUsuario, setRolUsuario] = useState(null)

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
  // 📌 LOGIN MANUAL ADMIN (usuario + contraseña)
  // ------------------------------------------------------------
  async function loginAdminManual(usuario, pass) {
    if (usuario === MASTER_USER && pass === MASTER_PASS) {
      const adminUser = {
        uid: 'admin-master',
        displayName: 'Administrador',
      }

      setUser(adminUser)
      setRolUsuario('admin')

      Swal.fire('Ingreso correcto', 'Bienvenido, administrador', 'success')
      cerrarLoginGlobal()
      return true
    }

    Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error')
    return false
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
  // 📌 Cargar rol desde Firestore
  // ------------------------------------------------------------
  async function cargarRol(uid) {
    try {
      if (uid === 'admin-master') {
        setRolUsuario('admin')
        return
      }

      const ref = doc(db, 'roles', uid)
      const snap = await getDoc(ref)

      if (snap.exists()) setRolUsuario(snap.data().rol)
      else setRolUsuario('invitado')
    } catch (err) {
      console.error('Error rol:', err)
      setRolUsuario('invitado')
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
      await cargarRol(u.uid)
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
      await cargarRol(u.uid)
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
        {
          size: 'invisible',
        }
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
      await cargarRol(u.uid)
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
    setRolUsuario(null)
  }

  // ------------------------------------------------------------
  // 📌 OBSERVAR SESIÓN
  // ------------------------------------------------------------
  useEffect(() => {
    cargarLoginSettings()

    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u || null)
      if (u) await cargarRol(u.uid)
    })

    return () => unsub()
  }, [])

  // ------------------------------------------------------------
  // 📌 VALUE DEL CONTEXT
  // ------------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        rolUsuario,

        loginSettings,

        // Métodos de login:
        loginGoogle,
        loginFacebook,
        loginTelefonoEnviarCodigo,
        loginTelefonoValidarCodigo,
        loginAdminManual, // 🔥 NUEVO

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
