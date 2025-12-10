// --------------------------------------------------------------
// AdminPage.jsx — PANEL ADMIN PREMIUM (SIDEBAR + CONTENIDO)
// --------------------------------------------------------------
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CrearEvento from '../components/admin/CrearEvento.jsx'
import ListaEventos from '../components/admin/ListaEventos.jsx'
import PedidosPendientes from '../components/admin/PedidosPendientes.jsx'
import AdminProductos from '../components/admin/AdminProductos.jsx'
import AdminEmpleados from '../components/admin/AdminEmpleados.jsx'
import LectorQr from '../components/qr/LectorQr.jsx'
import AdminConfiguracion from '../components/admin/AdminConfiguracion.jsx'
import ComprasAdmin from '../components/admin/ComprasAdmin.jsx'
import EntradasAdmin from '../components/admin/EntradasAdmin.jsx'
import DashboardVentas from '../components/admin/DashboardVentas.jsx'
import '../components/admin/admin.css'

export default function AdminPage() {
  const navigate = useNavigate()
  const [seccion, setSeccion] = useState('menu')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Render dinámico
  function renderSeccion() {
    switch (seccion) {
      case 'crear-evento':
        return <CrearEvento />
      case 'eventos-lista':
        return <ListaEventos />

      // 🔥 NUEVOS COMPONENTES ADMIN
      case 'entradas-pendientes':
        return <EntradasAdmin />
      case 'compras-pendientes':
        return <ComprasAdmin />
      case 'dashboard':
        return <DashboardVentas />
      case 'productos':
        return <AdminProductos />
      case 'empleados':
        return <AdminEmpleados />
      case 'qr':
        return <LectorQr />
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

  return (
    <div className="admin-layout">
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h3 className="sidebar-title">ADMIN</h3>

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

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('entradas-pendientes')
            setSidebarOpen(false)
          }}
        >
          🎟 Entradas
        </button>

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('compras-pendientes')
            setSidebarOpen(false)
          }}
        >
          🛒 Compras
        </button>
        <button
          className="side-btn"
          onClick={() => {
            setSeccion('dashboard')
            setSidebarOpen(false)
          }}
        >
          📊 Dashboard
        </button>

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('productos')
            setSidebarOpen(false)
          }}
        >
          🍹 Productos
        </button>

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('empleados')
            setSidebarOpen(false)
          }}
        >
          👤 Empleados
        </button>

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('qr')
            setSidebarOpen(false)
          }}
        >
          📱 Validador QR
        </button>

        <button
          className="side-btn"
          onClick={() => {
            setSeccion('config')
            setSidebarOpen(false)
          }}
        >
          ⚙️ Configuración
        </button>

        <button className="side-btn exit" onClick={() => navigate('/')}>
          ⬅ Salir
        </button>
      </aside>

      {/* ---------------- CONTENIDO ---------------- */}
      <main className="admin-main">
        {/* Botón menú móvil */}
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
