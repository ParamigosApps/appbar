// --------------------------------------------------------------
// AdminPage.jsx — PANEL ADMIN PREMIUM con QR Entradas / QR Caja
// --------------------------------------------------------------

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Secciones internas
import CrearEvento from '../components/admin/CrearEvento.jsx'
import ListaEventos from '../components/admin/ListaEventos.jsx'
import EditarEvento from '../components/admin/EditarEvento.jsx'
import AdminProductos from '../components/admin/AdminProductos.jsx'
import AdminEmpleados from '../components/admin/AdminEmpleados.jsx'
import AdminConfiguracion from '../components/admin/AdminConfiguracion.jsx'
import ComprasAdmin from '../components/admin/ComprasAdmin.jsx'
import EntradasAdmin from '../components/admin/EntradasAdmin.jsx'
import DashboardVentas from '../components/admin/DashboardVentas.jsx'
import DashboardLiquidaciones from '../components/admin/DashboardLiquidaciones.jsx'

import '../styles/admin/admin.css'

import { escucharCantidadEntradasPendientes } from '../services/entradasAdmin.js'

export default function AdminPage() {
  const navigate = useNavigate()
  const { user: firebaseUser, esAdminReal, logout } = useAuth()

  const [seccion, setSeccion] = useState('menu')
  const [editarId, setEditarId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [entradasPendientes, setEntradasPendientes] = useState(0)

  useEffect(() => {
    if (!esAdminReal) return

    const unsub = escucharCantidadEntradasPendientes(setEntradasPendientes)
    return () => unsub && unsub()
  }, [esAdminReal])

  // --------------------------------------------------------------
  // Render dinámico
  // --------------------------------------------------------------
  function renderSeccion() {
    switch (seccion) {
      case 'crear-evento':
        return <CrearEvento setSeccion={setSeccion} />

      case 'eventos-lista':
        return (
          <ListaEventos setSeccion={setSeccion} setEditarId={setEditarId} />
        )

      case 'editar-evento':
        return <EditarEvento editarId={editarId} setSeccion={setSeccion} />

      case 'entradas-pendientes':
        return <EntradasAdmin />

      case 'compras-pendientes':
        return <ComprasAdmin />

      case 'dashboard':
        return <DashboardVentas />

      case 'liquidaciones':
        return <DashboardLiquidaciones />

      case 'productos':
        return <AdminProductos />

      case 'empleados':
        return <AdminEmpleados />

      case 'config':
        return <AdminConfiguracion />

      default:
        return (
          <div className="admin-welcome text-center">
            <h2 className="fw-bold">Panel de Administración</h2>
            <p className="text-muted mt-2">Seleccioná una sección del menú</p>
          </div>
        )
    }
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h3 className="sidebar-title">ADMIN</h3>

        <div className="admin-user-info">
          <div className="user-name">
            {firebaseUser?.displayName || firebaseUser?.email || 'Usuario'}
          </div>
          <div className="user-role">Rol: Administrador</div>
        </div>

        {esAdminReal && (
          <>
            <button
              className="side-btn"
              onClick={() => {
                setSeccion('crear-evento')
                setSidebarOpen(false)
              }}
            >
              ➕ Crear Evento
            </button>

            <button
              className="side-btn"
              onClick={() => {
                setSeccion('eventos-lista')
                setSidebarOpen(false)
              }}
            >
              🎉 Eventos
            </button>
          </>
        )}

        {esAdminReal && (
          <button
            className="side-btn side-btn-badge"
            onClick={() => {
              setSeccion('entradas-pendientes')
              setSidebarOpen(false)
            }}
          >
            🎟 Entradas
            {entradasPendientes > 0 && (
              <span className="badge-pendientes">{entradasPendientes}</span>
            )}
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('dashboard')
              setSidebarOpen(false)
            }}
          >
            📊 Dashboard
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('liquidaciones')
              setSidebarOpen(false)
            }}
          >
            💰 Liquidaciones
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('compras-pendientes')
              setSidebarOpen(false)
            }}
          >
            🛒 Compras
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('productos')
              setSidebarOpen(false)
            }}
          >
            🍹 Productos
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('empleados')
              setSidebarOpen(false)
            }}
          >
            👤 Empleados
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => navigate('/admin/qr-entradas')}
          >
            🎫 Validador Entradas
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => navigate('/admin/qr-caja')}
          >
            🍸 Validador Caja
          </button>
        )}

        {esAdminReal && (
          <button
            className="side-btn"
            onClick={() => {
              setSeccion('config')
              setSidebarOpen(false)
            }}
          >
            ⚙️ Configuración
          </button>
        )}

        <button
          className="side-btn exit"
          onClick={async () => {
            await logout()
            navigate('/acceso', { replace: true })
          }}
        >
          ⬅ Salir
        </button>
      </aside>

      <main className="admin-main">
        <button
          className="admin-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>

        <div className="admin-content">{renderSeccion()}</div>
      </main>
    </div>
  )
}
