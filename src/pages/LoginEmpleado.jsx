// --------------------------------------------------------------
// LoginEmpleado.jsx — SOLO Login (Google + Email/Password)
// --------------------------------------------------------------
import { useFirebase } from '../context/FirebaseContext.jsx'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'

import googleIcon from '../assets/img/google.png'

export default function LoginEmpleado() {
  const { loginGoogle, user, empleadoData, isAdmin } = useFirebase()
  const navigate = useNavigate()

  // Login manual
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')

  // ======================================================
  // LOGIN EMAIL
  // ======================================================
  // LOGIN MANUAL SIMPLE (TEMPORAL)
  async function loginManual() {
    if (email === 'admin' && pass === '1234') {
      Swal.fire('Bienvenido Admin', 'Acceso otorgado', 'success')

      // guardamos un "flag" temporal en localStorage
      localStorage.setItem('adminTemp', 'true')

      navigate('/admin')
      return
    }

    Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error')
  }

  // ======================================================
  // REDIRIGIR SI YA ESTÁ LOGUEADO
  // ======================================================
  useEffect(() => {
    if (user && (empleadoData || isAdmin)) navigate('/admin')
  }, [user, empleadoData, isAdmin])

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 450 }}>
      <h2 className="fw-bold mb-4">Ingreso Empleados</h2>

      {/* GOOGLE */}
      <button className="btn-google mb-3" onClick={loginGoogle}>
        <img src={googleIcon} className="icon-google" />
        Iniciar con Google
      </button>

      <div className="text-muted my-2">o</div>

      {/* LOGIN EMAIL */}
      <input
        className="form-control mb-2"
        placeholder="Email"
        onChange={e => setEmail(e.target.value)}
      />

      <input
        className="form-control mb-3"
        placeholder="Contraseña"
        type="password"
        onChange={e => setPass(e.target.value)}
      />

      <button className="btn btn-dark w-100" onClick={loginManual}>
        Iniciar sesión
      </button>

      {/* OPCIÓN PARA IR AL PANEL DE LOGIN GENERAL SI QUERÉS */}
      <p
        className="mt-3 text-primary fw-semibold"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/acceso')}
      >
        ← Volver a opciones
      </p>
    </div>
  )
}
