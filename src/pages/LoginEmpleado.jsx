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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginEmpleado() {
  const {
    loginAdminManual,
    adminSession, // ✅ antes adminUser
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

    if (esAdminTotal() || adminSession) {
      navigate('/admin', { replace: true })
    }
  }, [authLoading, adminSession, esAdminTotal, navigate])

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
