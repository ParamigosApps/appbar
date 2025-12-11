// --------------------------------------------------------------
// App.jsx — Rutas Admin con QR Entradas / QR Caja (VERSIÓN FINAL)
// --------------------------------------------------------------
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Estilos globales

import Layout from './components/layout/Layout.jsx'

// PÁGINAS PÚBLICAS
import Home from './pages/Home.jsx'
import MisEntradas from './components/entradas/MisEntradas.jsx'
import HistorialEntradas from './components/entradas/HistorialEntradas.jsx'

// ACCESOS
import Acceso from './pages/Acceso.jsx'
import LoginEmpleado from './pages/LoginEmpleado.jsx'

// ADMIN
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminPage from './pages/AdminPage.jsx'
import EditarEvento from './components/admin/EditarEvento.jsx'
import CrearEvento from './components/admin/CrearEvento.jsx'
import AdminProductos from './components/admin/AdminProductos.jsx'
import AdminConfiguracion from './components/admin/AdminConfiguracion.jsx'
import AdminEmpleados from './components/admin/AdminEmpleados.jsx'
import LectorQr from './components/qr/LectorQr.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ACCESOS SIN LAYOUT */}
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/login-empleado" element={<LoginEmpleado />} />

        {/* RUTAS PÚBLICAS (Con Layout) */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/historial" element={<HistorialEntradas />} />
        </Route>

        {/* ADMIN DASHBOARD */}
        <Route element={<AdminRoute modulo="dashboard" />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        {/* ADMIN EVENTOS */}
        <Route element={<AdminRoute modulo="eventos" />}>
          <Route path="/admin/crear-evento" element={<CrearEvento />} />
          <Route
            path="/admin/editar-evento/:eventoId"
            element={<EditarEvento />}
          />
        </Route>

        {/* ADMIN PRODUCTOS */}
        <Route element={<AdminRoute modulo="productos" />}>
          <Route path="/admin/productos" element={<AdminProductos />} />
        </Route>

        {/* ADMIN LECTOR QR ENTRADAS */}
        <Route element={<AdminRoute modulo="qr" />}>
          <Route
            path="/admin/qr-entradas"
            element={<LectorQr modoInicial="entradas" />}
          />
        </Route>

        {/* ADMIN LECTOR QR CAJA */}
        <Route element={<AdminRoute modulo="caja" />}>
          <Route
            path="/admin/qr-caja"
            element={<LectorQr modoInicial="caja" />}
          />
        </Route>

        {/* ADMIN EMPLEADOS */}
        <Route element={<AdminRoute modulo="empleados" />}>
          <Route path="/admin/empleados" element={<AdminEmpleados />} />
        </Route>

        {/* ADMIN CONFIGURACIÓN */}
        <Route element={<AdminRoute modulo="config" />}>
          <Route path="/admin/config" element={<AdminConfiguracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
