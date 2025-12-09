// --------------------------------------------------------------
// AdminRoute.jsx — ACCESO TEMPORAL + LOGIN admin/1234
// --------------------------------------------------------------
import { Navigate } from 'react-router-dom'

export default function AdminRoute({ children }) {
  const adminTemp = localStorage.getItem('adminTemp') === 'true'

  if (adminTemp) {
    return children
  }

  return <Navigate to="/empleado" replace />
}
