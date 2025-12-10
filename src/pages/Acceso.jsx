// --------------------------------------------------------------
// Acceso.jsx — Pantalla principal de acceso (Premium)
// --------------------------------------------------------------
import { useNavigate } from 'react-router-dom'
import googleIcon from '../assets/img/google.png'
import './acceso.css'

export default function Acceso() {
  const navigate = useNavigate()

  return (
    <div className="acceso-container">
      <div className="acceso-card">
        <h1 className="titulo-acceso">Bienvenido</h1>
        <p className="subtitulo-acceso">
          Elegí cómo querés ingresar a la plataforma
        </p>

        {/* LOGIN GOOGLE DIRECTO */}
        <button
          className="btn-google w-100 mb-3"
          onClick={() => navigate('/login-empleado')}
        >
          <img src={googleIcon} className="icon-google" />
          Iniciar con Google
        </button>

        {/* SEPARADOR */}
        <div className="acceso-divider">
          <span>o</span>
        </div>

        {/* LOGIN MANUAL EMPLEADO / ADMIN */}
        <button
          className="btn-dark w-100 acceso-btn"
          onClick={() => navigate('/login-empleado')}
        >
          Ingreso Empleados / Admin
        </button>

        {/* OPTIONAL - acceso usuario común más adelante */}
        {/* 
        <button
          className="btn-light w-100 acceso-btn mt-2"
          onClick={() => navigate("/login")}
        >
          Ingreso Clientes
        </button>
        */}
      </div>
    </div>
  )
}
