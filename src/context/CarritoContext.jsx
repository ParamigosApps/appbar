// --------------------------------------------------------------
// src/context/CarritoContext.jsx — VERSIÓN FINAL DEFINITIVA
// Carrito funcional + Toastify + límite 3 + apertura Pendientes
// --------------------------------------------------------------
import { createContext, useContext, useState } from 'react'
import Swal from 'sweetalert2'
import Toastify from 'toastify-js'
import 'toastify-js/src/toastify.css'

import { useAuth } from './AuthContext.jsx'
import { useFirebase } from './FirebaseContext.jsx'
import { usePedidos } from './PedidosContext.jsx'

import {
  validarLimitePendientes,
  crearPedido,
} from '../services/comprasService.js'
import { crearPreferenciaCompra } from '../services/mercadopago.js'
import { mostrarQrCompraReact } from '../components/qr/ModalQrCompra.jsx'

const CarritoContext = createContext()
export const useCarrito = () => useContext(CarritoContext)

// --------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------
function normalizarPrecio(valor) {
  if (!valor) return 0
  if (typeof valor === 'string')
    return Number(
      valor.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim()
    )
  return valor || 0
}

const format = n => n.toLocaleString('es-AR')

// --------------------------------------------------------------
// PROVIDER
// --------------------------------------------------------------
export function CarritoProvider({ children }) {
  const { user } = useFirebase()
  const { abrirLoginGlobal } = useAuth()
  const { abrirPendientes } = usePedidos() || {}

  const [carrito, setCarrito] = useState(
    JSON.parse(localStorage.getItem('carrito')) || []
  )

  const [panelAbierto, setPanelAbierto] = useState(false)

  const syncLocalStorage = data =>
    localStorage.setItem('carrito', JSON.stringify(data))

  const abrirCarrito = () => setPanelAbierto(true)
  const cerrarCarrito = () => setPanelAbierto(false)

  const calcularTotal = () =>
    carrito.reduce(
      (acc, p) => acc + normalizarPrecio(p.precio) * p.enCarrito,
      0
    )

  // --------------------------------------------------------------
  // AGREGAR
  // --------------------------------------------------------------
  function agregarProducto(producto) {
    const nuevo = [...carrito]
    const existente = nuevo.find(p => p.id === producto.id)

    const cantidadNueva = producto.enCarrito || 1
    const stockDisponible = producto.stock ?? Infinity
    const cantidadActual = existente ? existente.enCarrito : 0

    if (cantidadActual + cantidadNueva > stockDisponible) {
      Swal.fire('No hay suficiente stock', '', 'error')
      return false
    }

    if (existente) {
      existente.enCarrito += cantidadNueva
    } else {
      nuevo.push({ ...producto, enCarrito: cantidadNueva })
    }

    setCarrito(nuevo)
    syncLocalStorage(nuevo)
    return true
  }

  // --------------------------------------------------------------
  // SUMAR (+)
  // --------------------------------------------------------------
  function sumarProducto(index) {
    const nuevo = [...carrito]
    const p = nuevo[index]

    if (p.enCarrito >= (p.stock ?? Infinity))
      return Swal.fire('No hay más stock', '', 'error')

    p.enCarrito++
    setCarrito(nuevo)
    syncLocalStorage(nuevo)

    Toastify({
      text: `Añadiste 1 unidad de ${p.nombre}`,
      duration: 1000,
      gravity: 'bottom',
      position: 'center',
      style: {
        background: '#14a8e2',
        width: '100%',
        borderRadius: '12px',
        fontWeight: '700',
        textAlign: 'center',
      },
    }).showToast()
  }

  // --------------------------------------------------------------
  // RESTAR (-)
  // --------------------------------------------------------------
  function restarProducto(index) {
    const nuevo = [...carrito]
    const p = nuevo[index]

    if (p.enCarrito === 1) return eliminarProducto(index)

    p.enCarrito--
    setCarrito(nuevo)
    syncLocalStorage(nuevo)

    Toastify({
      text: `Quitaste 1 unidad de ${p.nombre}`,
      duration: 1200,
      gravity: 'bottom',
      position: 'center',
      style: {
        background: '#ff5959',
        width: '100%',
        borderRadius: '12px',
        fontWeight: '700',
        textAlign: 'center',
      },
    }).showToast()
  }

  // --------------------------------------------------------------
  // ELIMINAR
  // --------------------------------------------------------------
  function eliminarProducto(index) {
    const nuevo = [...carrito]
    const eliminado = nuevo[index]

    nuevo.splice(index, 1)
    setCarrito(nuevo)
    syncLocalStorage(nuevo)

    Toastify({
      text: `Eliminaste ${eliminado.nombre}`,
      duration: 1300,
      gravity: 'bottom',
      position: 'center',
      style: {
        background: '#ff5959',
        width: '100%',
        borderRadius: '12px',
        fontWeight: '700',
        textAlign: 'center',
      },
    }).showToast()
  }

  // --------------------------------------------------------------
  // FINALIZAR COMPRA — versión perfecta
  // --------------------------------------------------------------
  async function finalizarCompra() {
    try {
      cerrarCarrito()

      // ❌ No logueado
      if (!user) {
        await Swal.fire({
          title: 'Debes iniciar sesión',
          text: 'Inicia sesión para continuar.',
          icon: 'warning',
          confirmButtonText: 'Iniciar sesión',
        })
        abrirLoginGlobal()
        return
      }

      if (carrito.length === 0)
        return Swal.fire('Carrito vacío', 'Añadí productos primero.', 'info')

      const total = calcularTotal()

      // ❌ Límite 3 pendientes
      const limite = await validarLimitePendientes(user.uid)
      if (limite) {
        await Swal.fire(
          'No puedes generar más pedidos',
          'Ya tienes 3 pedidos pendientes.',
          'warning'
        )

        abrirCarrito()
        abrirPendientes?.()
        return
      }

      let metodoSeleccionado = null

      const res = await Swal.fire({
        title: `<span class="swal-title-main">Finalizar compra</span>`,

        html: `
    <div class="resumen-lote-box">

      <p><b>Resumen de compra</b></p>
      <hr />

      <div class="info-limites-box">
        ${carrito
          .map(
            p => `
              <div class="limite-row">
                <span class="label">
                  ${p.nombre} x ${p.enCarrito}u
                </span>
                <span class="value">
                  $${format(normalizarPrecio(p.precio) * p.enCarrito)}
                </span>
              </div>
            `
          )
          .join('')}

        <div class="limite-row total">
          <span class="label">Total</span>
          <span class="value highlight">$${format(total)}</span>
        </div>
      </div>

      <div class="metodos-wrapper">
        <!-- MERCADO PAGO -->
        <button
          id="mp"
          type="button"
          class="method-btn method-mp only-logo"
        >
          <img
            src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadopago/logo__large.png"
            alt="Mercado Pago"
            class="mp-logo"
          />
        </button>

        <!-- PAGO EN CAJA -->
        <button
          id="transfer"
          type="button"
          class="method-btn method-transfer"
        >
          Pago en caja
        </button>
      </div>

    </div>
  `,

        showConfirmButton: false,
        showDenyButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',

        customClass: {
          popup: 'swal-popup-custom',
          cancelButton: 'swal-btn-cancel',
        },

        buttonsStyling: false,

        // 🔑 ACÁ SE CONECTAN LOS BOTONES
        didOpen: () => {
          const mpBtn = document.getElementById('mp')
          const trBtn = document.getElementById('transfer')

          if (mpBtn) {
            mpBtn.onclick = () => {
              metodoSeleccionado = 'mp'
              Swal.close()
            }
          }

          if (trBtn) {
            trBtn.onclick = () => {
              metodoSeleccionado = 'transfer'
              Swal.close()
            }
          }
        },
      })

      // ⛔ Cancelado (esc / botón cancelar / click afuera)
      // ⛔ Si cerró sin elegir método
      if (!metodoSeleccionado) return

      cerrarCarrito()

      // 🟡 PAGO EN CAJA
      if (metodoSeleccionado === 'transfer') {
        const pedido = await crearPedido({
          carrito,
          total,
          lugar: 'Tienda',
          pagado: false,
        })

        if (!pedido) {
          await Swal.fire({
            title: 'Límite alcanzado',
            text: 'Ya alcanzaste el máximo de pedidos permitidos.',
            icon: 'info',
            customClass: {
              popup: 'swal-popup-custom',
              htmlContainer: 'swal-text-center',
              confirmButton: 'swal-btn-confirm',
            },
            buttonsStyling: false,
          })
          return
        }

        await mostrarQrCompraReact({
          carrito,
          total,
          ticketId: pedido.ticketId,
          numeroPedido: pedido.numeroPedido,
          fechaHumana: pedido.fechaHumana,
          estado: 'pendiente',
          lugar: 'Tienda',
          qrText: `Compra:${pedido.ticketId}`,
        })

        setCarrito([])
        syncLocalStorage([])
        return
      }

      // 🟢 MERCADO PAGO
      if (metodoSeleccionado === 'mp') {
        const pedido = await crearPedido({
          carrito,
          total,
          lugar: 'Tienda',
          pagado: true,
        })

        if (!pedido) {
          await Swal.fire({
            title: 'Límite alcanzado',
            text: 'Ya alcanzaste el máximo de pedidos permitidos.',
            icon: 'info',
            customClass: {
              popup: 'swal-popup-custom',
              htmlContainer: 'swal-text-center',
              confirmButton: 'swal-btn-confirm',
            },
            buttonsStyling: false,
          })
          return
        }

        const initPoint = await crearPreferenciaCompra({
          carrito,
          ticketId: pedido.ticketId,
        })

        setCarrito([])
        syncLocalStorage([])

        window.location.href = initPoint
      }
    } catch (err) {
      console.error('❌ Error finalizarCompra:', err)
      Swal.fire('Error', err.message, 'error')
    }
  }

  const cantidadCarrito = carrito.reduce((a, p) => a + p.enCarrito, 0)

  return (
    <CarritoContext.Provider
      value={{
        carrito,
        panelAbierto,
        abrirCarrito,
        cerrarCarrito,
        agregarProducto,
        sumarProducto,
        restarProducto,
        eliminarProducto,
        calcularTotal,
        cantidadCarrito,
        finalizarCompra,
        normalizarPrecio,
        format,
      }}
    >
      {children}
    </CarritoContext.Provider>
  )
}
