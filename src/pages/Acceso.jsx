// --------------------------------------------------------------
// Acceso.jsx — Pantalla para elegir tipo de usuario
// --------------------------------------------------------------
import { useNavigate } from 'react-router-dom'

export default function Acceso() {
  const navigate = useNavigate()

  return (
    <div className="container py-5 text-center">
      <h2 className="fw-bold mb-4">¿Cómo querés ingresar?</h2>

      <div className="d-flex flex-column gap-3">
        <button
          className="btn btn-primary py-3 fw-semibold"
          onClick={() => navigate('/')}
        >
          🟦 Soy Cliente
        </button>

        <button
          className="btn btn-warning py-3 fw-semibold"
          onClick={() => navigate('/empleado')}
        >
          🟠 Soy Empleado
        </button>

        <button
          className="btn btn-dark py-3 fw-semibold"
          onClick={() => navigate('/empleado')}
        >
          🟣 Soy Administrador
        </button>
      </div>
    </div>
  )
}
