// --------------------------------------------------------------
// LoginEmpleado.jsx — Usuario/Contraseña (admin manual)
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

import googleIcon from '../assets/img/google.png'

export default function LoginEmpleado() {
  const { loginAdminManual, user, rolUsuario } = useAuth()
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    navigate('/admin', { replace: true })
  }

  // 🔁 Si ya está logueado como admin
  useEffect(() => {
    if (user && rolUsuario > 0) {
      navigate('/admin', { replace: true })
    }
  }, [user, rolUsuario, navigate])

  return (
    <div className="login-wrapper">
      <h2 className="login-title">PANEL ADMIN</h2>

      <div className="login-divider">Accedé al panel de empleados</div>

      {/* FORM */}
      <form className="login-form" onSubmit={loginLocal}>
        <input
          className={`form-control mb-2 ${error ? 'is-invalid' : ''}`}
          placeholder="Ingresá tu mail"
          value={usuario}
          onChange={e => {
            setUsuario(e.target.value)
            setError('')
          }}
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
        />

        {/* ❌ ERROR EN ROJO */}
        {error && (
          <div className="text-danger text-center small mb-2">{error}</div>
        )}

        <button type="submit" className="btn btn-dark w-100" disabled={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="login-back" onClick={() => navigate('/')}>
        ← Volver
      </p>
    </div>
  )
}
