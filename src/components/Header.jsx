// --------------------------------------------------------------
// src/components/Header.jsx — CARRITO CORRECTO
// --------------------------------------------------------------
import { Link } from 'react-router-dom'
import { useCarrito } from '../context/CarritoContext.jsx'

import logo from '../assets/img/logo.png'
import carritoImg from '../assets/img/carrito.png'

export default function Header() {
  const { abrirCarrito, cantidadCarrito } = useCarrito()

  return (
    <header className="app-header">
      <Link className="navbar-brand" to="/">
        <img src={logo} alt="Logo" className="header-logo-img" />
      </Link>

      <div id="carritoIcono" className="carrito-icono" onClick={abrirCarrito}>
        <img src={carritoImg} alt="carrito" />
        {cantidadCarrito > 0 && (
          <span className="contadorCarrito">{cantidadCarrito}</span>
        )}
      </div>
    </header>
  )
}
