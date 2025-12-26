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
import 'react-toastify/dist/ReactToastify.css'
import Swal from 'sweetalert2'

import { guardarPerfilUsuario } from '../services/usuarioService'
import { enviarMail } from '../services/mailService'
import { mailLogin } from '../services/mailTemplates'
import { showLoading, hideLoading } from '../services/loadingService.js'
import { useEvento } from './EventosContext'

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
  const { validarEventoVigente, limpiarEvento } = useEvento()
  const eventoCtx = useEvento()
  console.log('EVENTO CTX:', eventoCtx)
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

  // ============================================================
  // RESTAURAR SESIÓN
  // ============================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        const ref = doc(db, 'usuarios', firebaseUser.uid)
        const snap = await getDoc(ref)

        if (snap.exists()) {
          setUser({
            ...firebaseUser,
            ...snap.data(),
          })
        } else {
          setUser(firebaseUser)
        }
      } else {
        setUser(null)
      }

      setAuthListo(true)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    let cancelado = false

    async function syncEventoConSesion() {
      if (!user) {
        limpiarEvento()
        return
      }

      const vigente = await validarEventoVigente()

      if (!vigente && !cancelado) {
        console.warn('Evento vencido al restaurar sesión')
      }
    }

    syncEventoConSesion()

    return () => {
      cancelado = true
    }
  }, [user])

  useEffect(() => {
    if (recaptchaRef.current) return

    try {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            console.log('✅ reCAPTCHA listo')
          },
        }
      )

      recaptchaRef.current.render()
    } catch (err) {
      console.error('❌ Error inicializando reCAPTCHA', err)
    }
  }, [])

  useEffect(() => {
    const handler = async () => {
      if (!auth.currentUser) return

      const ref = doc(db, 'usuarios', auth.currentUser.uid)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        setUser(u => ({ ...u, ...snap.data() }))
      }
    }

    window.addEventListener('perfil-actualizado', handler)
    return () => window.removeEventListener('perfil-actualizado', handler)
  }, [])
  useEffect(() => {
    cargarPermisosSistema()
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

  function puedeEditarPerfil(user) {
    if (!user?.provider) return false

    // ❌ Google y Facebook: NO pueden editar nombre/email
    if (user.provider === 'google' || user.provider === 'facebook') {
      return false
    }

    // ✔️ Phone u otros
    return true
  }

  // ============================================================
  // LOGIN GOOGLE
  // ============================================================
  async function loginGoogle() {
    let loadingTimeout

    try {
      showLoading({
        title: 'Iniciando sesión',
        text: 'Conectando con Google...',
      })

      // ⏱️ Timeout de seguridad (NO interfiere con login correcto)
      loadingTimeout = setTimeout(() => {
        hideLoading()
      }, 4000)

      const res = await signInWithPopup(auth, new GoogleAuthProvider())
      const u = res.user

      clearTimeout(loadingTimeout)

      const ref = doc(db, 'usuarios', u.uid)
      const snap = await getDoc(ref)
      const esPrimerLogin = !snap.exists()

      await setDoc(
        ref,
        {
          uid: u.uid,
          email: u.email,
          nombre: u.displayName || u.email,
          provider: 'google',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      hideLoading()

      setUser({
        ...u,
        nombre: u.displayName || u.email,
        provider: 'google',
      })

      // 📧 MAIL SOLO PRIMER LOGIN (NO BLOQUEANTE)
      if (esPrimerLogin && u.email) {
        enviarMail({
          to: u.email,
          subject: '👋 Bienvenido a AppBar',
          html: mailLogin({
            nombre: u.displayName || 'Hola',
            provider: 'Google',
          }),
        }).catch(err => console.warn('⚠️ Mail de bienvenida no enviado:', err))
      }
    } catch (err) {
      clearTimeout(loadingTimeout)

      console.error('❌ Error login Google:', err)

      // ⛔ Canceló el popup → cerrar loading inmediato
      if (err.code === 'auth/popup-closed-by-user') {
        hideLoading()
        return
      }
    } finally {
      clearTimeout(loadingTimeout)
      hideLoading()
    }
  }

  // ============================================================
  // LOGIN FACEBOOK
  // ============================================================
  async function loginFacebook() {
    let loadingTimeout

    try {
      showLoading({
        title: 'Iniciando sesión',
        text: 'Conectando con Facebook...',
      })

      // ⏱️ Timeout de seguridad (NO interfiere con login correcto)
      loadingTimeout = setTimeout(() => {
        hideLoading()
      }, 4000)

      const res = await signInWithPopup(auth, new FacebookAuthProvider())
      const u = res.user

      clearTimeout(loadingTimeout)

      const ref = doc(db, 'usuarios', u.uid)
      const snap = await getDoc(ref)
      const esPrimerLogin = !snap.exists()

      await setDoc(
        ref,
        {
          uid: u.uid,
          email: u.email,
          nombre: u.displayName || u.email,
          provider: 'facebook',
          creadoEn: serverTimestamp(),
        },
        { merge: true }
      )

      hideLoading()

      setUser({
        ...u,
        nombre: u.displayName || u.email,
        provider: 'facebook',
      })

      // 📧 MAIL SOLO PRIMER LOGIN (NO BLOQUEANTE)
      if (esPrimerLogin && u.email) {
        enviarMail({
          to: u.email,
          subject: '👋 Bienvenido a AppBar',
          html: mailLogin({
            nombre: u.displayName || 'Hola',
            provider: 'Facebook',
          }),
        }).catch(err =>
          console.warn('⚠️ Mail bienvenida Facebook no enviado:', err)
        )
      }
    } catch (err) {
      clearTimeout(loadingTimeout)

      console.error('❌ Error login Facebook:', err)

      // ⛔ Canceló el popup → cerrar loading inmediato
      if (err.code === 'auth/popup-closed-by-user') {
        hideLoading()
        return
      }

      toast.error('No se pudo iniciar sesión con Facebook')
    } finally {
      clearTimeout(loadingTimeout)
      hideLoading()
    }
  }

  function normalizarTelefonoAR(phone) {
    let p = phone.replace(/\D/g, '')

    if (p.startsWith('0')) p = p.slice(1)
    if (p.startsWith('15')) p = p.slice(2)
    if (!p.startsWith('54')) p = '54' + p
    if (!p.startsWith('549')) p = '549' + p.slice(2)

    return '+' + p
  }

  // ============================================================
  // LOGIN TELÉFONO
  // ============================================================

  async function loginTelefonoValidarCodigo(code) {
    if (!confirmationRef.current) {
      toast.error('Primero solicitá el código')
      return
    }

    if (!code || code.length < 4) {
      toast.error('Ingresá el código recibido')
      return
    }

    try {
      const res = await confirmationRef.current.confirm(code)
      const u = res.user

      const ref = doc(db, 'usuarios', u.uid)
      const snap = await getDoc(ref)

      const esPrimerLogin = !snap.exists()

      let nombre = snap.exists() ? snap.data().nombre : ''
      let nombreConfirmado = snap.exists()
        ? snap.data().nombreConfirmado === true
        : false

      let datos = null

      if (esPrimerLogin || !nombreConfirmado) {
        datos = await pedirNombreYEmail({
          nombreActual: nombre,
          emailActual: snap.exists() ? snap.data().email : '',
        })

        if (!datos) return

        nombre = datos.nombre
      }

      const perfil = await guardarPerfilUsuario({
        uid: u.uid,
        nombre,
        emailNuevo: datos?.email ?? null,
        phoneNumber: u.phoneNumber,
        provider: 'phone',
      })

      setUser({
        ...u,
        nombre: perfil.nombre,
        email: perfil.email,
        phoneNumber: u.phoneNumber,
        provider: 'phone',
      })

      confirmationRef.current = null
      recaptchaRef.current = null
      toast.success('Sesión iniciada')
    } catch (err) {
      console.error('ERROR VALIDANDO SMS:', err)

      if (err.code === 'auth/invalid-verification-code') {
        toast.error('Código incorrecto')
      } else if (err.code === 'auth/code-expired') {
        toast.error('El código expiró. Volvé a solicitarlo.')
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Demasiados intentos. Esperá unos minutos.')
      } else {
        toast.error('No se pudo validar el código')
      }
    }
  }

  async function loginTelefonoEnviarCodigo(phoneRaw) {
    if (!phoneRaw) {
      toast.error('Ingresá un teléfono')
      return
    }

    try {
      const phone = normalizarTelefonoAR(phoneRaw)

      // 🔒 Inicializar reCAPTCHA SOLO si no existe
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              console.log('✅ reCAPTCHA resuelto')
            },
            'expired-callback': () => {
              console.warn('⚠️ reCAPTCHA expirado')
              recaptchaRef.current = null
            },
          }
        )

        // 🔥 Importante: render explícito
        await recaptchaRef.current.render()
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaRef.current
      )

      confirmationRef.current = confirmation

      toast.success('Código enviado por SMS')
    } catch (err) {
      console.error('ERROR ENVIANDO SMS:', err)

      // 🔁 Resetear reCAPTCHA ante error
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear()
        } catch {}
        recaptchaRef.current = null
      }

      if (err.code === 'auth/too-many-requests') {
        toast.error('Demasiados intentos. Esperá unos minutos.')
      } else if (err.code === 'auth/invalid-phone-number') {
        toast.error('Número inválido')
      } else if (err.code === 'auth/missing-recaptcha-token') {
        toast.error('Error de verificación. Reintentá.')
      } else {
        toast.error('No se pudo enviar el código')
      }
    }
  }

  async function pedirNombreYEmail({
    nombreActual = '',
    emailActual = '',
    titulo = '👤 Datos de tu cuenta',
  }) {
    const { value, isConfirmed } = await Swal.fire({
      title: titulo,
      html: `
      <input id="swal-nombre" class="swal2-input" placeholder="Tu nombre" value="${nombreActual}">
      <input id="swal-email" class="swal2-input" placeholder="Email (opcional)" value="${emailActual}">
      <p style="font-size:12px;color:#777">
        El email es opcional, pero te permite recibir tus entradas por correo.
      </p>
    `,
      focusConfirm: false,
      confirmButtonText: 'Guardar',
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      preConfirm: () => {
        const nombre = document.getElementById('swal-nombre').value.trim()
        const email = document.getElementById('swal-email').value.trim()

        if (!nombre || nombre.length < 2) {
          Swal.showValidationMessage('Ingresá un nombre válido')
          return false
        }

        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
          Swal.showValidationMessage('Email inválido')
          return false
        }

        return {
          nombre,
          email: email || null,
        }
      },
    })

    if (!isConfirmed) return null
    return value
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
        puedeEditarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
