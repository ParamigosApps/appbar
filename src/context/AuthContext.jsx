// -----------------------------------------------------------
// 📌 AUTH CONTEXT — versión FINAL con persistencia REAL
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
// LOGIN ADMIN MANUAL (NO FIREBASE) – PERO PERSISTE EN LOCALSTORAGE
// -----------------------------------------------------------
const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
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
  // 🔥 LOGIN ADMIN MANUAL CON PERSISTENCIA LOCAL
  // -----------------------------------------------------------
  async function loginAdminManual(usuario, pass) {
    try {
      if (usuario === MASTER_USER && pass === MASTER_PASS) {
        const adminUser = {
          uid: 'admin-master',
          displayName: 'Administrador',
          email: 'admin@app.com',
          manual: true,
        }

        setUser(adminUser)
        setRolUsuario(4)
        localStorage.setItem('adminTemp', JSON.stringify(adminUser))

        Swal.fire('Ingreso correcto', 'Bienvenido administrador', 'success')
        cerrarLoginGlobal()
        return true
      }

      // Empleado normal
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

      const empleadoUser = {
        uid: data.uid,
        displayName: data.nombre,
        email: data.email,
        manual: true,
      }

      setUser(empleadoUser)
      setRolUsuario(Number(data.nivel) || 1)

      localStorage.setItem('adminTemp', JSON.stringify(empleadoUser))

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
  // LOGIN GOOGLE
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
    setRolUsuario(0)
    localStorage.removeItem('adminTemp')
  }

  // -----------------------------------------------------------
  // 🔥 RESTAURAR SESIÓN MANUAL + SESIÓN FIREBASE
  // -----------------------------------------------------------
  useEffect(() => {
    cargarPermisos()

    // 1) Revisar login manual
    const temp = localStorage.getItem('adminTemp')
    if (temp) {
      const saved = JSON.parse(temp)
      setUser(saved)
      setRolUsuario(saved.uid === 'admin-master' ? 4 : 1)
      setLoading(false)
      return
    }

    // 2) Revisar login Firebase
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u)
        await cargarRol(u.uid)
      } else {
        setUser(null)
        setRolUsuario(0)
      }
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // -----------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
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
