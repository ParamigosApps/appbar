// -----------------------------------------------------------
// 📌 AUTH CONTEXT — versión FINAL con persistencia REAL (PRO)
// -----------------------------------------------------------
import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../Firebase.js'

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'

import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

import Swal from 'sweetalert2'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// -----------------------------------------------------------
// CONSTANTES LOCALSTORAGE
// -----------------------------------------------------------
const LS_ADMIN = 'session_admin'

// -----------------------------------------------------------
// LOGIN ADMIN MANUAL
// -----------------------------------------------------------
const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

export function AuthProvider({ children }) {
  // 👤 USUARIO FRONT
  const [user, setUser] = useState(null)

  // 🛠 ADMIN / EMPLEADO
  const [adminUser, setAdminUser] = useState(null)

  const [rolUsuario, setRolUsuario] = useState(0)
  const [permisos, setPermisos] = useState({})
  const [loading, setLoading] = useState(true)

  const [loginSettings, setLoginSettings] = useState({
    google: true,
    facebook: true,
    phone: true,
  })

  const [loginAbierto, setLoginAbierto] = useState(false)

  // -----------------------------------------------------------
  function abrirLoginGlobal() {
    setLoginAbierto(true)
    document.dispatchEvent(new CustomEvent('abrir-login'))
  }

  function cerrarLoginGlobal() {
    setLoginAbierto(false)
  }

  // -----------------------------------------------------------
  // 🔥 LOGIN ADMIN / EMPLEADO (NO FIREBASE)
  // -----------------------------------------------------------
  async function loginAdminManual(usuario, pass) {
    try {
      // ADMIN MASTER
      if (usuario === MASTER_USER && pass === MASTER_PASS) {
        const admin = {
          uid: 'admin-master',
          displayName: 'Administrador',
          email: 'admin@app.com',
          manual: true,
        }

        setAdminUser(admin)
        setRolUsuario(4)
        localStorage.setItem(LS_ADMIN, JSON.stringify(admin))

        Swal.fire('Ingreso correcto', 'Bienvenido administrador', 'success')
        cerrarLoginGlobal()
        return true
      }

      // EMPLEADO NORMAL
      const q = query(
        collection(db, 'empleados'),
        where('email', '==', usuario),
        where('password', '==', pass)
      )

      const snap = await getDocs(q)
      if (snap.empty) {
        Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error')
        return false
      }

      const data = snap.docs[0].data()

      const empleado = {
        uid: data.uid,
        displayName: data.nombre,
        email: data.email,
        manual: true,
      }

      setAdminUser(empleado)
      setRolUsuario(Number(data.nivel) || 1)
      localStorage.setItem(LS_ADMIN, JSON.stringify(empleado))

      Swal.fire('Ingreso correcto', `Bienvenido, ${data.nombre}`, 'success')
      cerrarLoginGlobal()
      return true
    } catch (err) {
      console.error('ERROR loginAdminManual:', err)
      Swal.fire('Error', 'No se pudo iniciar sesión', 'error')
      return false
    }
  }

  // -----------------------------------------------------------
  async function cargarPermisos() {
    try {
      const ref = doc(db, 'configuracion', 'permisos')
      const snap = await getDoc(ref)
      if (snap.exists()) setPermisos(snap.data())
    } catch (err) {
      console.error('Error cargando permisos:', err)
    }
  }

  async function cargarRol(uid) {
    try {
      if (uid === 'admin-master') {
        setRolUsuario(4)
        return
      }

      const q = query(collection(db, 'empleados'), where('uid', '==', uid))
      const snap = await getDocs(q)

      if (!snap.empty) {
        const data = snap.docs[0].data()
        setRolUsuario(Number(data.nivel) || 1)
        return
      }

      setRolUsuario(0)
    } catch (err) {
      console.error('Error rol:', err)
    }
  }

  // -----------------------------------------------------------
  // LOGIN GOOGLE (USUARIOS FRONT)
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
      cerrarLoginGlobal()
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // -----------------------------------------------------------
  async function loginFacebook() {
    try {
      const provider = new FacebookAuthProvider()
      const res = await signInWithPopup(auth, provider)
      const u = res.user

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          nombre: u.displayName,
          email: u.email,
          uid: u.uid,
          provider: 'facebook',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser(u)
      cerrarLoginGlobal()
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return
      Swal.fire('Error', err.message, 'error')
    }
  }

  // -----------------------------------------------------------
  // LOGOUT TOTAL
  // -----------------------------------------------------------
  async function logout() {
    await signOut(auth)
    setUser(null)
    setAdminUser(null)
    setRolUsuario(0)
    localStorage.removeItem(LS_ADMIN)
  }

  // -----------------------------------------------------------
  // 🔥 RESTAURAR SESIÓN
  // -----------------------------------------------------------
  useEffect(() => {
    cargarPermisos()

    // 1️⃣ ADMIN
    const adminSession = localStorage.getItem(LS_ADMIN)
    if (adminSession) {
      const saved = JSON.parse(adminSession)
      setAdminUser(saved)
      setRolUsuario(saved.uid === 'admin-master' ? 4 : 1)
      setLoading(false)
      return
    }

    // 2️⃣ FIREBASE USER
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // -----------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        // 👤 FRONT
        user,

        // 🛠 ADMIN
        adminUser,
        rolUsuario,
        permisos,
        loading,

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
