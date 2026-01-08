// --------------------------------------------------------------
// AdminRoute.jsx — PROTECCIÓN FINAL DEFINITIVA (RBAC)
// --------------------------------------------------------------

/*
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRoute({ modulo }) {
  const { adminUser, loading, esAdminTotal, tienePermiso } = useAuth()

  // ⏳ Esperar a que auth + permisos estén listos
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>Cargando permisos…</div>
    )
  }

  // ❌ No es admin manual
  if (!adminUser) {
    return <Navigate to="/acceso" replace />
  }

  // 🔓 Admin total → acceso absoluto
  if (esAdminTotal()) {
    return <Outlet />
  }

  // 🔐 Permiso por módulo (empleados con nivel < 4)
  if (modulo && !tienePermiso(modulo)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
*/
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminRoute({ modulo }) {
  const { adminSession, loading, esAdminTotal, tienePermiso } = useAuth()

  // ⏳ Esperar a que auth esté listo
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>Cargando permisos…</div>
    )
  }

  // ❌ No hay sesión admin
  if (!adminSession) {
    return <Navigate to="/acceso" replace />
  }

  // 🔓 Admin total
  if (esAdminTotal()) {
    return <Outlet />
  }

  // 🔐 Permiso por módulo
  if (modulo && !tienePermiso(modulo)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
