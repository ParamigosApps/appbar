// --------------------------------------------------------------
// LoginEmpleado.jsx — Google + Usuario/Contraseña (admin manual)
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Swal from 'sweetalert2'

import googleIcon from '../assets/img/google.png'

export default function LoginEmpleado() {
  const { loginGoogle, loginAdminManual, user, rolUsuario } = useAuth()
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')

  async function loginLocal(e) {
    e.preventDefault()
    if (!usuario || !pass) {
      Swal.fire('Error', 'Completá los campos', 'error')
      return
    }
    const ok = await loginAdminManual(usuario, pass)
    if (ok) navigate('/admin')
  }

  useEffect(() => {
    if (user && rolUsuario > 0) {
      navigate('/admin', { replace: true })
    }
  }, [user, rolUsuario, navigate])

  return (
    <div className="login-wrapper">
      <h2 className="login-title">PANEL ADMIN</h2>

      <div className="login-divider">Accedé al menu de Empleados</div>

      {/* FORM */}
      <form className="login-form" onSubmit={loginLocal}>
        <input
          className="form-control mb-2"
          placeholder="Ingresa tu mail"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
        />

        <input
          className="form-control mb-3"
          placeholder="Ingresa tu contraseña"
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
        />

        <button type="submit" className="btn btn-dark w-100">
          Iniciar sesión
        </button>
      </form>

      <p className="login-back" onClick={() => navigate('/')}>
        ← Volver
      </p>
    </div>
  )
}
