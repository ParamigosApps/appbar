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

  // -------------------------------------------------------
  // LOGIN MANUAL
  // -------------------------------------------------------
  async function loginLocal(e) {
    e.preventDefault()

    if (!usuario || !pass) {
      Swal.fire('Error', 'Completá los campos', 'error')
      return
    }

    const ok = await loginAdminManual(usuario, pass)

    if (ok) navigate('/admin')
  }

  // -------------------------------------------------------
  // REDIRECCIÓN SI YA ESTÁ LOGUEADO
  // -------------------------------------------------------
  useEffect(() => {
    if (user && rolUsuario !== 'invitado') {
      navigate('/admin', { replace: true })
    }
  }, [user, rolUsuario, navigate])

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 450 }}>
      <h2 className="fw-bold mb-4">Ingreso Empleados / Admin</h2>

      {/* GOOGLE LOGIN */}
      <button className="btn-google mb-3 w-100" onClick={loginGoogle}>
        <img src={googleIcon} className="icon-google" alt="google" />
        Iniciar con Google
      </button>

      <div className="text-muted my-3">o acceder con usuario/contraseña</div>

      {/* FORMULARIO CORRECTO */}
      <form onSubmit={loginLocal}>
        <input
          className="form-control mb-2"
          placeholder="Usuario"
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

      <p
        className="mt-3 text-primary fw-semibold"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/')}
      >
        ← Volver
      </p>
    </div>
  )
}
