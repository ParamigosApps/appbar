// --------------------------------------------------------------
// AdminRoute.jsx — Protección REAL con loading + permisos (FIX)
// --------------------------------------------------------------
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRoute({ modulo }) {
  const { adminUser, rolUsuario, permisos, loading } = useAuth()

  // ⏳ Mientras carga auth → no mostrar nada PERO sin romper navegación
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>
  }

  if (!adminUser) return <Navigate to="/acceso" replace />

  // 🔐 Permisos aún no disponibles
  if (!permisos || !permisos[`nivel${rolUsuario}`]) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Verificando permisos...
      </div>
    )
  }

  const lista = permisos[`nivel${rolUsuario}`]

  // ✅ Acceso total
  if (lista.includes('*')) {
    return <Outlet />
  }

  // ❌ No tiene permiso para el módulo
  if (modulo && !lista.includes(modulo)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
