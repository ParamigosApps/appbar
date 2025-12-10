// --------------------------------------------------------------
// src/App.jsx — Versión CORREGIDA y con export default válido
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

// Modales globales
import ModalSeleccionLote from './components/entradas/ModalSeleccionLote.jsx'
import ModalMetodoPago from './components/entradas/ModalMetodoPago.jsx'

export default function App() {
  // ⬅⬅⬅ IMPORTANTE
  return (
    <>
      {/* Modales globales */}
      <ModalSeleccionLote />
      <ModalMetodoPago />

      <BrowserRouter>
        <Routes>
          {/* RUTAS PÚBLICAS SIN LAYOUT */}
          <Route path="/acceso" element={<Acceso />} />
          <Route path="/login-empleado" element={<LoginEmpleado />} />

          {/* RUTAS CON LAYOUT */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<CatalogoSection />} />
            <Route path="/mis-entradas" element={<MisEntradas />} />
            <Route path="/historial" element={<HistorialEntradas />} />

            {/* Ruta previa (compatibilidad) */}
            <Route path="/empleado" element={<LoginEmpleado />} />
          </Route>

          {/* RUTA ADMIN PROTEGIDA */}
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
    </>
  )
}
