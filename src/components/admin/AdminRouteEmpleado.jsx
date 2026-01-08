/*import { Navigate } from 'react-router-dom'
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
*/
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRouteEmpleado({ children, permiso }) {
  const { adminSession, loading } = useAuth()

  if (loading) return null

  // ❌ No hay sesión admin
  if (!adminSession) {
    return <Navigate to="/empleado" replace />
  }

  // 🔓 Admin total
  if (adminSession.nivel === 4) {
    return children
  }

  // 🔐 Permiso puntual (si usás niveles o strings, ajustá acá)
  if (permiso && permiso !== adminSession.permiso) {
    return <Navigate to="/empleado" replace />
  }

  return children
}
