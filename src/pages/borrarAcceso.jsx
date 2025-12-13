// --------------------------------------------------------------
// Acceso.jsx — Pantalla principal de acceso (Premium)
// --------------------------------------------------------------
import { useNavigate } from 'react-router-dom'

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
