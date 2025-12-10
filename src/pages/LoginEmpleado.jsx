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

  // -------------------------------------------------------
  // LOGIN MANUAL (admin / 1234)
  // -------------------------------------------------------
  async function loginLocal() {
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
      navigate('/admin')
    }
  }, [user, rolUsuario])

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 450 }}>
      <h2 className="fw-bold mb-4">Ingreso Empleados / Admin</h2>

      {/* GOOGLE LOGIN */}
      <button className="btn-google mb-3 w-100" onClick={loginGoogle}>
        <img src={googleIcon} className="icon-google" alt="google" />
        Iniciar con Google
      </button>

      <div className="text-muted my-3">o acceder con usuario/contraseña</div>

      {/* CAMPOS LOGIN MANUAL */}
      <input
        className="form-control mb-2"
        placeholder="Usuario"
        onChange={e => setUsuario(e.target.value)}
      />

      <input
        className="form-control mb-3"
        placeholder="Contraseña"
        type="password"
        onChange={e => setPass(e.target.value)}
      />

      <button className="btn btn-dark w-100" onClick={loginLocal}>
        Iniciar sesión
      </button>

      <p
        className="mt-3 text-primary fw-semibold"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/acceso')}
      >
        ← Volver
      </p>
    </div>
  )
}
