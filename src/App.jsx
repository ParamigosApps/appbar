// --------------------------------------------------------------
// App.jsx — Rutas Admin con QR Entradas / QR Caja
// --------------------------------------------------------------
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/SwalTheme.css'

import Layout from './components/layout/Layout.jsx'

// PÚBLICAS
import Home from './pages/Home.jsx'
import CatalogoSection from './components/catalogo/CatalogoSection.jsx'
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

        {/* RUTAS PÚBLICAS */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<CatalogoSection />} />
          <Route path="/mis-entradas" element={<MisEntradas />} />
          <Route path="/historial" element={<HistorialEntradas />} />
        </Route>

        {/* ADMIN PRINCIPAL */}
        <Route element={<AdminRoute modulo="dashboard" />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        {/* EVENTOS */}
        <Route element={<AdminRoute modulo="eventos" />}>
          <Route path="/admin/crear-evento" element={<CrearEvento />} />
          <Route
            path="/admin/editar-evento/:eventoId"
            element={<EditarEvento />}
          />
        </Route>

        {/* PRODUCTOS */}
        <Route element={<AdminRoute modulo="productos" />}>
          <Route path="/admin/productos" element={<AdminProductos />} />
        </Route>

        {/* LECTOR ENTRADAS */}
        <Route element={<AdminRoute modulo="qr" />}>
          <Route
            path="/admin/qr-entradas"
            element={<LectorQr modoInicial="entradas" />}
          />
        </Route>

        {/* LECTOR CAJA */}
        <Route element={<AdminRoute modulo="caja" />}>
          <Route
            path="/admin/qr-caja"
            element={<LectorQr modoInicial="caja" />}
          />
        </Route>

        {/* EMPLEADOS */}
        <Route element={<AdminRoute modulo="empleados" />}>
          <Route path="/admin/empleados" element={<AdminEmpleados />} />
        </Route>

        {/* CONFIGURACIÓN */}
        <Route element={<AdminRoute modulo="config" />}>
          <Route path="/admin/config" element={<AdminConfiguracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
