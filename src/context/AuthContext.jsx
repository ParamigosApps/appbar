// -----------------------------------------------------------
// 📌 AUTH CONTEXT — FINAL ESTABLE
// -----------------------------------------------------------
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { auth, db } from '../Firebase.js'
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
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
import Swal from 'sweetalert2'
import { toast } from 'react-toastify'
const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

const LS_ADMIN = 'session_admin'
const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [rolUsuario, setRolUsuario] = useState(0)
  const [permisos, setPermisos] = useState({})
  const [loading, setLoading] = useState(true)

  const [loginSettings] = useState({
    google: true,
    facebook: true,
    phone: true,
  })
  const recaptchaRef = useRef(null)
  const [loginAbierto, setLoginAbierto] = useState(false)

  // -----------------------------------------------------------
  // TELÉFONO
  // -----------------------------------------------------------
  const confirmationRef = useRef(null)

  async function loginTelefonoEnviarCodigo(phone) {
    if (!phone || phone.length < 8) {
      toast.error('Ingresá un número válido')
      return
    }

    try {
      toast.info('Enviando código SMS...', { autoClose: 2000 })

      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
          }
        )
      }

      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaRef.current
      )

      toast.success('Código enviado 📲 Revisá tu SMS')
    } catch (err) {
      console.error(err)

      if (err.code === 'auth/too-many-requests') {
        toast.error('Demasiados intentos. Probá más tarde.')
      } else if (err.code === 'auth/invalid-phone-number') {
        toast.error('Número inválido')
      } else {
        toast.error('No se pudo enviar el código')
      }
    }
  }

  async function loginTelefonoValidarCodigo(code) {
    if (!confirmationRef.current) {
      toast.error('Primero solicitá el código')
      return
    }

    try {
      toast.info('Validando código...')

      const res = await confirmationRef.current.confirm(code)

      await setDoc(
        doc(db, 'usuarios', res.user.uid),
        {
          uid: res.user.uid,
          phoneNumber: res.user.phoneNumber,
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser(res.user)

      toast.success('Sesión iniciada correctamente ✅')
    } catch (err) {
      toast.error('Código incorrecto')
    }
  }

  // -----------------------------------------------------------
  function abrirLoginGlobal() {
    setLoginAbierto(true)
    document.dispatchEvent(new CustomEvent('abrir-login'))
  }

  function cerrarLoginGlobal() {
    setLoginAbierto(false)
  }

  // -----------------------------------------------------------
  // ADMIN MANUAL
  // -----------------------------------------------------------
  async function loginAdminManual(usuario, pass) {
    try {
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
        cerrarLoginGlobal()
        return true
      }

      const q = query(
        collection(db, 'empleados'),
        where('email', '==', usuario),
        where('password', '==', pass)
      )

      const snap = await getDocs(q)
      if (snap.empty) return false

      const data = snap.docs[0].data()

      setAdminUser({
        uid: data.uid,
        displayName: data.nombre,
        email: data.email,
        manual: true,
      })

      setRolUsuario(Number(data.nivel) || 1)
      localStorage.setItem(LS_ADMIN, JSON.stringify(data))
      cerrarLoginGlobal()
      return true
    } catch {
      return false
    }
  }

  // -----------------------------------------------------------
  async function loginGoogle() {
    const res = await signInWithPopup(auth, new GoogleAuthProvider())
    const u = res.user

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

    setUser({ ...u, nombre: u.displayName || u.email })
    cerrarLoginGlobal()
  }

  async function loginFacebook() {
    const res = await signInWithPopup(auth, new FacebookAuthProvider())
    const u = res.user

    await setDoc(
      doc(db, 'usuarios', u.uid),
      {
        nombre: u.displayName || u.email,
        email: u.email,
        uid: u.uid,
        provider: 'facebook',
        creadoEn: serverTimestamp(),
      },
      { merge: true }
    )

    setUser({ ...u, nombre: u.displayName || u.email })
    cerrarLoginGlobal()
  }

  async function logout() {
    await signOut(auth)
    setUser(null)
    setAdminUser(null)
    setRolUsuario(0)
    localStorage.removeItem(LS_ADMIN)
  }

  // -----------------------------------------------------------
  // RESTAURAR SESIÓN
  // -----------------------------------------------------------
  useEffect(() => {
    // ADMIN MANUAL (NO corta Firebase)
    const adminSession = localStorage.getItem(LS_ADMIN)
    if (adminSession) {
      const saved = JSON.parse(adminSession)
      setAdminUser(saved)
      setRolUsuario(saved.uid === 'admin-master' ? 4 : 1)
    }

    // FIREBASE AUTH (SIEMPRE)
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        try {
          const ref = doc(db, 'usuarios', u.uid)
          const snap = await getDoc(ref)
          setUser(snap.exists() ? { ...u, ...snap.data() } : u)
        } catch {
          setUser(u)
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        adminUser,
        rolUsuario,
        permisos,
        loading,
        loginSettings,
        loginGoogle,
        loginFacebook,
        loginTelefonoEnviarCodigo,
        loginTelefonoValidarCodigo,
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
