// --------------------------------------------------------------
// src/components/Navbar.jsx — VERSIÓN FINAL
// --------------------------------------------------------------
import { useCarrito } from '../context/CarritoContext.jsx'
import { Link } from 'react-router-dom'

import logo from '../assets/img/logo.png'
import carritoImg from '../assets/img/carrito.png'

export default function Navbar() {
  const { abrirCarrito, carrito } = useCarrito()

  // ✔ Tu web original usa "enCarrito"
  const cantidad = carrito.reduce((acc, p) => acc + (p.enCarrito || 0), 0)

  return (
    <header className="app-header">
      {/* LOGO CENTRADO COMO EN TU WEB */}
      <Link className="navbar-brand" to="/">
        <img src={logo} alt="Logo" className="header-logo-img" />
      </Link>

      {/* CARRITO FLOTANTE (NO DENTRO DEL HEADER) */}
      <div id="carritoIcono" className="carrito-icono" onClick={abrirCarrito}>
        <img src={carritoImg} id="img-carrito" alt="carrito" />
        {cantidad > 0 && <span className="contadorCarrito">{cantidad}</span>}
      </div>
    </header>
  )
}
