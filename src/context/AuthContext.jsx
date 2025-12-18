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
import { toast } from 'react-toastify'

// ============================================================
// CONTEXT
// ============================================================
const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// ============================================================
// CONSTANTES
// ============================================================
const LS_ADMIN = 'session_admin'
const MASTER_USER = 'admin'
const MASTER_PASS = '1234'

// ============================================================
// PROVIDER
// ============================================================
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [rolUsuario, setRolUsuario] = useState(0)
  const [permisos, setPermisos] = useState({})
  const [loading, setLoading] = useState(true)

  // 🔑 FLAGS REALES
  const [authListo, setAuthListo] = useState(false)
  const [permisosListos, setPermisosListos] = useState(false)

  const [loginSettings] = useState({
    google: true,
    facebook: true,
    phone: true,
  })

  const recaptchaRef = useRef(null)
  const confirmationRef = useRef(null)
  const [loginAbierto, setLoginAbierto] = useState(false)

  // ============================================================
  // RESTAURAR SESIÓN
  // ============================================================
  useEffect(() => {
    // 1️⃣ ADMIN MANUAL (localStorage)
    const adminSession = localStorage.getItem(LS_ADMIN)
    if (adminSession) {
      const saved = JSON.parse(adminSession)
      setAdminUser(saved)
      setRolUsuario(saved.uid === 'admin-master' ? 4 : Number(saved.nivel || 1))
    }

    // 2️⃣ PERMISOS DEL SISTEMA
    cargarPermisosSistema()

    // 3️⃣ FIREBASE AUTH (usuarios normales)
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

      setAuthListo(true)
    })

    return () => unsub()
  }, [])

  // 🔑 cerrar loading solo cuando TODO esté listo
  useEffect(() => {
    if (authListo && permisosListos) {
      setLoading(false)
    }
  }, [authListo, permisosListos])

  // ============================================================
  // PERMISOS DEL SISTEMA
  // ============================================================
  async function cargarPermisosSistema() {
    try {
      const ref = doc(db, 'configuracion', 'permisos')
      const snap = await getDoc(ref)

      if (snap.exists()) {
        setPermisos(snap.data())
      } else {
        console.error('❌ configuracion/permisos no existe')
        setPermisos({})
      }
    } catch (err) {
      console.error('❌ Error cargando permisos:', err)
      setPermisos({})
    } finally {
      setPermisosListos(true)
    }
  }

  // ============================================================
  // LOGIN GOOGLE
  // ============================================================
  async function loginGoogle() {
    try {
      const res = await signInWithPopup(auth, new GoogleAuthProvider())
      const u = res.user

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          uid: u.uid,
          email: u.email,
          nombre: u.displayName || u.email,
          provider: 'google',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser({ ...u, nombre: u.displayName || u.email })
      cerrarLoginGlobal()
    } catch (err) {
      console.error(err)
      // toast.error('Error al iniciar sesión con Google')
    }
  }

  // ============================================================
  // LOGIN FACEBOOK
  // ============================================================
  async function loginFacebook() {
    try {
      const res = await signInWithPopup(auth, new FacebookAuthProvider())
      const u = res.user

      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          uid: u.uid,
          email: u.email,
          nombre: u.displayName || u.email,
          provider: 'facebook',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      setUser({ ...u, nombre: u.displayName || u.email })
      cerrarLoginGlobal()
    } catch (err) {
      console.error(err)
      toast.error('Error al iniciar sesión con Facebook')
    }
  }

  // ============================================================
  // LOGIN TELÉFONO
  // ============================================================
  async function loginTelefonoEnviarCodigo(phone) {
    if (!phone || phone.length < 8) {
      toast.error('Ingresá un número válido')
      return
    }

    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          { size: 'invisible' }
        )
      }

      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaRef.current
      )

      toast.success('Código enviado 📲')
    } catch {
      toast.error('No se pudo enviar el código')
    }
  }

  async function loginTelefonoValidarCodigo(code) {
    if (!confirmationRef.current) {
      toast.error('Primero solicitá el código')
      return
    }

    try {
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
      toast.success('Sesión iniciada ✅')
    } catch {
      toast.error('Código incorrecto')
    }
  }

  // ============================================================
  // LOGIN ADMIN MANUAL (YA CORRECTO)
  // ============================================================
  async function loginAdminManual(usuario, pass) {
    try {
      if (usuario === MASTER_USER && pass === MASTER_PASS) {
        const admin = {
          uid: 'admin-master',
          displayName: 'Administrador',
          email: 'admin@app.com',
          manual: true,
          nivel: 4,
        }

        setAdminUser(admin)
        setRolUsuario(4)
        localStorage.setItem(LS_ADMIN, JSON.stringify(admin))
        return { ok: true }
      }

      const q = query(
        collection(db, 'empleados'),
        where('email', '==', usuario)
      )

      const snap = await getDocs(q)
      if (snap.empty)
        return { ok: false, error: 'Usuario o contraseña incorrectos' }

      const data = snap.docs[0].data()

      if (data.password !== pass)
        return { ok: false, error: 'Contraseña incorrecta' }

      const admin = {
        uid: data.uid,
        displayName: data.nombre,
        email: data.email,
        manual: true,
        nivel: Number(data.nivel || 1),
      }

      setAdminUser(admin)
      setRolUsuario(admin.nivel)
      localStorage.setItem(LS_ADMIN, JSON.stringify(admin))

      return { ok: true }
    } catch (err) {
      console.error(err)
      return { ok: false, error: 'Error inesperado. Intentá nuevamente.' }
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================
  async function logout() {
    await signOut(auth)
    setUser(null)
    setAdminUser(null)
    setRolUsuario(0)
    localStorage.removeItem(LS_ADMIN)
  }

  // ============================================================
  // PROVIDER
  // ============================================================
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
        abrirLoginGlobal: () => setLoginAbierto(true),
        cerrarLoginGlobal: () => setLoginAbierto(false),
        loginAbierto,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
