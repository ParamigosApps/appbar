import { Navigate } from 'react-router-dom'
import { useFirebase } from '../../context/FirebaseContext.jsx'

export default function AdminRouteEmpleado({ children, permiso }) {
  const { user, empleadoData, loading } = useFirebase()

  if (loading) return null

  if (!user) return <Navigate to="/empleado" />

  if (!empleadoData) return <Navigate to="/empleado" />

  // Si tiene uno de los permisos requeridos
  if (
    permiso.includes(empleadoData.permiso) ||
    empleadoData.permiso === 'Nivel4'
  ) {
    return children
  }

  return <Navigate to="/empleado" />
}
