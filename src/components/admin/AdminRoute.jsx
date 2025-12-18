// --------------------------------------------------------------
// AdminRoute.jsx — PROTECCIÓN FINAL DEFINITIVA (nivel1..nivel4)
// --------------------------------------------------------------
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRoute({ modulo }) {
  const { adminUser, rolUsuario, permisos, loading, logout } = useAuth()

  // ⏳ Esperar TODO
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>Cargando permisos…</div>
    )
  }

  if (!adminUser) {
    return <Navigate to="/acceso" replace />
  }

  const claveNivel = `nivel${Number(rolUsuario)}`
  const listaPermisos = permisos?.[claveNivel]

  if (!Array.isArray(listaPermisos)) {
    console.error('❌ Permisos faltantes para', claveNivel, permisos)
    setTimeout(() => logout(), 0)
    return <Navigate to="/acceso" replace />
  }

  if (listaPermisos.includes('*')) {
    return <Outlet />
  }

  if (modulo && !listaPermisos.includes(modulo)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
