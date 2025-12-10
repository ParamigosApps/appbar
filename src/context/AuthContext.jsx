// -----------------------------------------------------------
// 📌 AUTH CONTEXT — versión ESTABLE con ADMIN manual
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

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// -----------------------------------------------------------
// ADMIN MANUAL
// -----------------------------------------------------------
const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [rolUsuario, setRolUsuario] = useState('invitado')

  const [loginSettings, setLoginSettings] = useState({
    google: true,
    facebook: true,
    phone: true,
  })

  const [loginAbierto, setLoginAbierto] = useState(false)

  function abrirLoginGlobal() {
    setLoginAbierto(true)
    document.dispatchEvent(new CustomEvent('abrir-login'))
  }
  function cerrarLoginGlobal() {
    setLoginAbierto(false)
  }

  // -----------------------------------------------------------
  // LOGIN ADMIN MANUAL
  // -----------------------------------------------------------
  async function loginAdminManual(usuario, pass) {
    if (usuario === MASTER_USER && pass === MASTER_PASS) {
      const adminUser = {
        uid: 'admin-master',
        displayName: 'Administrador',
      }

      setUser(adminUser)
      setRolUsuario('admin')

      // FLAG para AdminRoute
      localStorage.setItem('adminTemp', 'true')

      Swal.fire('Ingreso correcto', 'Bienvenido, administrador', 'success')
      cerrarLoginGlobal()
      return true
    }

    Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error')
    return false
  }

  // -----------------------------------------------------------
  // LOGIN SETTINGS
  // -----------------------------------------------------------
  async function cargarLoginSettings() {
    try {
      const ref = doc(db, 'configuracion', 'loginMetodos')
      const snap = await getDoc(ref)
      if (snap.exists()) setLoginSettings(snap.data())
    } catch {}
  }

  // -----------------------------------------------------------
  // CARGAR ROL
  // -----------------------------------------------------------
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
    } catch {
      setRolUsuario('invitado')
    }
  }

  // -----------------------------------------------------------
  // GOOGLE
  // -----------------------------------------------------------
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
      if (err.code === 'auth/popup-closed-by-user') return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // -----------------------------------------------------------
  // FACEBOOK
  // -----------------------------------------------------------
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
      if (err.code === 'auth/popup-closed-by-user') return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // -----------------------------------------------------------
  // LOGOUT
  // -----------------------------------------------------------
  async function logout() {
    await signOut(auth)
    setUser(null)
    setRolUsuario('invitado')
    localStorage.removeItem('adminTemp')
  }

  // -----------------------------------------------------------
  // OBSERVAR SESIÓN
  // -----------------------------------------------------------
  useEffect(() => {
    cargarLoginSettings()

    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u || null)

      if (u) {
        await cargarRol(u.uid)
      } else {
        setRolUsuario('invitado')
      }
    })

    return () => unsub()
  }, [])

  // -----------------------------------------------------------
  // CONTEXT VALUE
  // -----------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        rolUsuario,

        loginSettings,

        loginGoogle,
        loginFacebook,
        loginAdminManual,

        logout,

        abrirLoginGlobal,
        cerrarLoginGlobal,
        loginAbierto,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
