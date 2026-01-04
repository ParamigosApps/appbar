// src/pages/Home.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

import Navbar from '../components/Navbar.jsx'
import CarritoOverlay from '../components/CarritoOverlay.jsx'
import MenuAcordeon from '../components/home/MenuAcordeon.jsx'

export default function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    const aviso = localStorage.getItem('avisoPostPago')
    if (!aviso) return

    // 🔒 Importante: se borra para que no vuelva a aparecer
    localStorage.removeItem('avisoPostPago')

    if (aviso === 'aprobado') {
      Swal.fire({
        title: '¡Pago confirmado!',
        html: `
          <p style="font-size:16px;font-weight:600;text-align:center;">
            Tu compra fue realizada con éxito 🎉
          </p>
          <p style="font-size:14px;text-align:center;color:#555;">
            Ya podés ver tus entradas.
          </p>
        `,
        icon: 'success',
        confirmButtonText: 'Ver mis entradas',
        customClass: {
          confirmButton: 'swal-btn-confirm',
        },
      }).then(result => {
        if (result.isConfirmed) {
          navigate('/')
          // 🔑 esperar al render del Home
          setTimeout(() => {
            document.dispatchEvent(new Event('abrir-mis-entradas'))
          }, 0)
        }
      })
    }

    if (aviso === 'rechazado') {
      Swal.fire({
        icon: 'error',
        title: 'Pago rechazado',
        text: 'No se realizó ningún cargo.',
        confirmButtonText: 'Entendido',
        buttonsStyling: false,
        customClass: {
          confirmButton: 'swal-btn-confirm',
        },
      }).then(() => {
        navigate('/')
      })
    }

    if (aviso === 'pendiente') {
      Swal.fire({
        title: 'Pago en verificación',
        html: `
          <p style="font-size:15px;font-weight:600;text-align:center;">
            Tu pedido quedó pendiente ⏳
          </p>
          <p style="font-size:14px;text-align:center;color:#555;">
            Comunicate con un administrador.<br />
            
          </p>
        `,
        icon: 'warning',
        confirmButtonText: 'Entendido',
        customClass: {
          confirmButton: 'swal-btn-confirm',
        },
      }).then(() => {
        navigate('/')
      })
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
