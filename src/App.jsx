// --------------------------------------------------------------
// src/App.jsx — Versión FINAL con sistema de accesos y empleados
// --------------------------------------------------------------
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Layout general
import Layout from './components/layout/Layout.jsx'

// Páginas públicas
import Home from './pages/Home.jsx'
import CatalogoSection from './components/catalogo/CatalogoSection.jsx'
import MisEntradas from './components/entradas/MisEntradas.jsx'
import HistorialEntradas from './components/entradas/HistorialEntradas.jsx'

// Accesos
import Acceso from './pages/Acceso.jsx'
import LoginEmpleado from './pages/LoginEmpleado.jsx'

// Admin
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ---------------------------------------------------------------- */}
        {/*                      RUTAS PÚBLICAS CON LAYOUT                   */}
        {/* ---------------------------------------------------------------- */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<CatalogoSection />} />
          <Route path="/mis-entradas" element={<MisEntradas />} />
          <Route path="/historial" element={<HistorialEntradas />} />

          {/* Acceso: Usuario / Empleado / Admin */}
          <Route path="/acceso" element={<Acceso />} />

          {/* Login de empleados/admin */}
          <Route path="/empleado" element={<LoginEmpleado />} />
        </Route>

        {/* ---------------------------------------------------------------- */}
        {/*                             PANEL ADMIN                         */}
        {/* ---------------------------------------------------------------- */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
