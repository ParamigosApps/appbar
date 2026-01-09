// --------------------------------------------------------------
// LoginEmpleado.jsx — Usuario/Contraseña (admin manual)
// --------------------------------------------------------------

/*
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginEmpleado() {
  const {
    loginAdminManual,
    adminUser,
    esAdminTotal,
    loading: authLoading,
  } = useAuth()

  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ------------------------------------------------------------
  // LOGIN ADMIN LOCAL
  // ------------------------------------------------------------
  async function loginLocal(e) {
    e.preventDefault()
    setError('')

    if (!usuario || !pass) {
      setError('Completá usuario y contraseña')
      return
    }

    setLoading(true)

    const res = await loginAdminManual(usuario, pass)

    setLoading(false)

    if (!res?.ok) {
      setError(res?.error || 'Credenciales incorrectas')
      return
    }

    // ✅ LOGIN ADMIN OK
    navigate('/admin', { replace: true })
  }

  // ------------------------------------------------------------
  // 🔁 SI YA ESTÁ LOGUEADO COMO ADMIN → REDIRIGIR
  // ------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return

    if (esAdminTotal() || adminUser) {
      navigate('/admin', { replace: true })
    }
  }, [authLoading, adminUser, esAdminTotal, navigate])

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="login-wrapper">
      <h2 className="login-title">PANEL ADMIN</h2>

      <div>Accedé al panel de empleados</div>
      <div className="bar-divider mb-3"></div>


      <form className="login-form" onSubmit={loginLocal}>
        <input
          className={`form-control mb-2 ${error ? 'is-invalid' : ''}`}
          placeholder="Ingresá tu mail"
          value={usuario}
          onChange={e => {
            setUsuario(e.target.value)
            setError('')
          }}
          autoComplete="username"
        />

        <input
          className={`form-control mb-2 ${error ? 'is-invalid' : ''}`}
          placeholder="Ingresá tu contraseña"
          type="password"
          value={pass}
          onChange={e => {
            setPass(e.target.value)
            setError('')
          }}
          autoComplete="current-password"
        />

  
        {error && (
          <div className="text-danger text-center small mb-2">{error}</div>
        )}

        <button type="submit" className="btn btn-dark w-100" disabled={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="login-back" onClick={() => navigate('/')}>
        ← Salir
      </p>
    </div>
  )
}
*/
// --------------------------------------------------------------
// LoginEmpleado.jsx — Admin REAL (Firebase Auth + Custom Claims)
// --------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../Firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginEmpleado() {
  const { loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ------------------------------------------------------------
  // LOGIN ADMIN CON GOOGLE (Firebase Auth)
  // ------------------------------------------------------------
  async function loginAdminGoogle() {
    setError('')
    setLoading(true)

    try {
      const res = await signInWithPopup(auth, new GoogleAuthProvider())
      const user = res.user

      // 🔐 Forzar refresh de token para leer claims
      await user.getIdToken(true)
      const token = await user.getIdTokenResult()

      if (token.claims.admin !== true) {
        throw new Error('Este usuario no tiene permisos de administrador')
      }

      // ✅ Admin real
      navigate('/admin', { replace: true })
    } catch (err) {
      console.error('❌ Login admin fallido:', err)
      setError(
        err.message === 'Este usuario no tiene permisos de administrador'
          ? 'No tenés permisos para acceder al panel admin'
          : 'No se pudo iniciar sesión'
      )
    } finally {
      setLoading(false)
    }
  }

  // ------------------------------------------------------------
  // 🔁 SI YA ESTÁ LOGUEADO Y ES ADMIN → REDIRIGIR
  // ------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return

    const u = auth.currentUser
    if (!u) return

    u.getIdTokenResult().then(token => {
      if (token.claims.admin === true) {
        navigate('/admin', { replace: true })
      }
    })
  }, [authLoading, navigate])

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="login-wrapper">
      <h2 className="login-title">PANEL ADMIN</h2>

      <div>Accedé con tu cuenta autorizada</div>
      <div className="bar-divider mb-3"></div>

      {error && (
        <div className="text-danger text-center small mb-3">{error}</div>
      )}

      <button
        className="btn btn-dark w-100"
        onClick={loginAdminGoogle}
        disabled={loading}
      >
        {loading ? 'Ingresando…' : 'Ingresar con Google'}
      </button>

      <p className="login-back" onClick={() => navigate('/')}>
        ← Salir
      </p>
    </div>
  )
}
