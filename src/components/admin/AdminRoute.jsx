// --------------------------------------------------------------
// AdminRoute.jsx — FIX LOOP INFINITO
// --------------------------------------------------------------
import { Navigate, useLocation } from 'react-router-dom'

export default function AdminRoute({ children }) {
  const adminTemp = localStorage.getItem('adminTemp') === 'true'
  const location = useLocation()

  // Si es admin → pasa
  if (adminTemp) return children

  // Si ya estamos en /empleado → NO redirigir de nuevo
  if (location.pathname === '/empleado') {
    return null
  }

  return <Navigate to="/empleado" replace />
}
