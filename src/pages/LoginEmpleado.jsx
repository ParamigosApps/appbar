// --------------------------------------------------------------
// LoginEmpleado.jsx — Google + Usuario/Contraseña (admin manual)
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Swal from 'sweetalert2'

import googleIcon from '../assets/img/google.png'

console.log('LOGIN EMPLEADO CARGADO OK')

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
      <h2 className="login-title">Ingreso Empleados / Admin</h2>

      {/* LOGIN GOOGLE */}
      <button className="btn-google" onClick={loginGoogle}>
        <img src={googleIcon} className="icon-google" alt="google" />
        Iniciar con Google
      </button>

      <div className="login-divider">o acceder con usuario/contraseña</div>

      {/* FORM */}
      <form className="login-form" onSubmit={loginLocal}>
        <input
          className="form-control mb-2"
          placeholder="Mail"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
        />

        <input
          className="form-control mb-3"
          placeholder="Contraseña"
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
