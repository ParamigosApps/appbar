// -----------------------------------------------------
// src/components/layout/Layout.jsx — VERSIÓN FINAL
// -----------------------------------------------------
import { Outlet } from 'react-router-dom'
import Header from '../Header.jsx'
import CarritoOverlay from '../CarritoOverlay.jsx'

export default function Layout() {
  return (
    <>
      {/* HEADER SIEMPRE ARRIBA */}
      <Header />

      {/* CONTENIDO PRINCIPAL */}
      <main className="mt-3">
        <Outlet />
      </main>

      {/* 🔥 EL CARRITO SIEMPRE AL FINAL DEL DOM */}
      <CarritoOverlay />
    </>
  )
}
