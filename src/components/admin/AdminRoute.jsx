// --------------------------------------------------------------
// AdminRoute.jsx — Protección REAL con loading + permisos
// --------------------------------------------------------------
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRoute({ modulo }) {
  const { user, rolUsuario, permisos, loading } = useAuth()

  // Esperar a que Firebase / LocalStorage terminen de cargar
  if (loading) return null

  // No está logueado
  if (!user) return <Navigate to="/login-empleado" replace />

  // Permisos aún no cargados
  if (!permisos || !permisos[`nivel${rolUsuario}`]) return null

  const lista = permisos[`nivel${rolUsuario}`]

  // Acceso total
  if (lista.includes('*')) return <Outlet />

  // Validar acceso al módulo
  if (!lista.includes(modulo)) return <Navigate to="/" replace />

  return <Outlet />
}
