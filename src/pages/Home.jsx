// src/pages/Home.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

import Navbar from '../components/Navbar.jsx'
import CarritoOverlay from '../components/CarritoOverlay.jsx'
import MenuAcordeon from '../components/home/MenuAcordeon.jsx'

export default function Home() {
  const navigate = useNavigate()
  const abrirCarrito = () => {
    setTimeout(() => {
      document.dispatchEvent(new Event('abrir-carrito'))
    }, 0)
  }

  useEffect(() => {
    const aviso = localStorage.getItem('avisoPostPago')
    if (!aviso) return

    // 🔒 Limpiar para evitar dobles ejecuciones
    localStorage.removeItem('avisoPostPago')

    const abrirMisEntradas = () => {
      setTimeout(() => {
        document.dispatchEvent(new Event('abrir-mis-entradas'))
      }, 0)
    }

    const abrirPedidos = () => {
      setTimeout(() => {
        document.dispatchEvent(new Event('abrir-pedidos'))
      }, 0)
    }

    switch (aviso) {
      // ============================
      // 🎟️ ENTRADAS
      // ============================
      case 'entrada_aprobada':
        Swal.fire({
          title: '¡Pago confirmado!',
          html: `
          <p style="font-size:16px;font-weight:600;text-align:center;">
            Tus entradas ya están disponibles 🎟️
          </p>
          <p style="font-size:14px;text-align:center;color:#555;">
            Podés verlas desde la sección <b>Mis Entradas</b>.
          </p>
        `,
          icon: 'success',
          confirmButtonText: 'Ver mis entradas',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        }).then(r => {
          if (r.isConfirmed) {
            navigate('/')
            abrirMisEntradas()
          }
        })
        break

      case 'entrada_rechazada':
        Swal.fire({
          icon: 'error',
          title: 'Pago rechazado',
          text: 'No se realizó ningún cargo. Las entradas no fueron emitidas.',
          confirmButtonText: 'Entendido',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        })
        break

      case 'entrada_pendiente':
        Swal.fire({
          icon: 'warning',
          title: 'Pago en verificación',
          html: `
          <p style="font-size:15px;text-align:center;">
            Tus entradas quedaron <b>pendientes</b> ⏳
          </p>
          <p style="font-size:14px;text-align:center;color:#555;">
            Estarán reservadas por un tiempo limitado.
          </p>
        `,
          confirmButtonText: 'Entendido',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        })
        break

      // ============================
      // 🛒 COMPRAS DE CATÁLOGO
      // ============================
      case 'compra_aprobada':
        Swal.fire({
          title: '¡Pago confirmado!',
          html: `
          <p style="font-size:16px;font-weight:600;text-align:center;">
            Tu pedido fue pagado con éxito 
          </p>
          <p style="font-size:14px;text-align:center;color:#555;">
            Podés ver el estado en <b>Tus pedidos</b>.
          </p>
        `,
          icon: 'success',
          confirmButtonText: 'Ver mis pedidos',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        }).then(r => {
          if (r.isConfirmed) {
            navigate('/')
            abrirPedidos()
          }
        })
        break

      case 'compra_rechazada':
        Swal.fire({
          icon: 'error',
          title: 'Pago rechazado',
          html: `
      <p style="text-align:center">
        No se realizó ningún cargo.<br/>
        Podés reintentar el pago desde el carrito.
      </p>
    `,
          confirmButtonText: 'Volver al carrito',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        }).then(r => {
          if (r.isConfirmed) {
            navigate('/')
            abrirCarrito()
          }
        })
        break

      case 'compra_pendiente':
        Swal.fire({
          icon: 'warning',
          title: 'Pedido pendiente',
          html: `
      <p style="text-align:center">
        Tu pedido fue generado como <b>pendiente</b> ⏳
      </p>
      <p style="font-size:14px;color:#555;text-align:center">
        Podés verlo o completarlo desde el carrito.
      </p>
    `,
          confirmButtonText: 'Ir al carrito',
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        }).then(() => {
          navigate('/')
          abrirCarrito()
        })
        break

      default:
        console.warn('⚠️ avisoPostPago desconocido:', aviso)
    }
  }, [navigate])

  return (
    <>
      <Navbar />
      <CarritoOverlay />

      <div className="container mt-3">
        <MenuAcordeon />
      </div>
    </>
  )
}
