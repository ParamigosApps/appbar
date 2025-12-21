// --------------------------------------------------------------
// src/context/CarritoContext.jsx — VERSIÓN FINAL DEFINITIVA
// Carrito funcional + Toastify + límite 3 + apertura Pendientes
// --------------------------------------------------------------
import { createContext, useContext, useState } from 'react'
import Swal from 'sweetalert2'

import { toastSuccess, toastInfo, toastWarning } from '../utils/toastifyUtils'

import { useAuth } from './AuthContext.jsx'
import { useFirebase } from './FirebaseContext.jsx'
import { usePedidos } from './PedidosContext.jsx'
import { validarStockCarrito } from '../services/stockService.js'
import {
  validarLimitePendientes,
  crearPedido,
} from '../services/comprasService.js'
import { crearPreferenciaCompra } from '../services/mercadopago.js'
import { mostrarQrCompraReact } from '../components/qr/ModalQrCompra.jsx'

import { abrirLoginGlobal } from '../utils/utils'
const CarritoContext = createContext()
export const useCarrito = () => useContext(CarritoContext)
import { swalRequiereLogin } from '../utils/swalUtils'
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

    toastSuccess('Se agregó 1 unidad al carrito')
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

    toastInfo(`Se quitó 1 unidad de ${p.nombre}`)
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

    toastWarning(`${eliminado.nombre} fue eliminado del carrito`)
  }

  // --------------------------------------------------------------
  // FINALIZAR COMPRA — versión perfecta
  // --------------------------------------------------------------
  async function finalizarCompra() {
    try {
      cerrarCarrito()

      // ❌ No logueado
      if (!user) {
        const res = await swalRequiereLogin()

        if (res.isConfirmed) {
          abrirLoginGlobal()
        }

        return
      }

      if (carrito.length === 0)
        return Swal.fire('Carrito vacío', 'Añadí productos primero.', 'info')
      // 🟡 VALIDAR STOCK REAL (OBLIGATORIO)
      const erroresStock = await validarStockCarrito(carrito)

      if (erroresStock.length > 0) {
        await Swal.fire({
          title: '⚠️ Productos faltantes',
          width: '420px',
          html: `
    <div style="font-size:15px; text-align:left; color: #333;">
      <p style="font-size:18px; font-weight: bold; margin-top: 8px; color: #d9534f;">
        Stock insuficiente en alguno de los productos solicitados.
      </p>
      <p>Algunos productos no tienen stock suficiente para completar tu pedido:</p>

      <hr style="border-top: 1px solid #ddd;">

      <ul style="padding-left: 20px; list-style-type: disc; margin-bottom: 10px;">
        ${erroresStock
          .map(e => `<li style="font-size: 14px; color: #555;">${e}</li>`)
          .join('')}
      </ul>

      <hr style="border-top: 1px solid #ddd;">

      <p style="font-size: 15px; color: #555;">
        Por favor, ajustá las cantidades en tu carrito y volvé a intentarlo.
      </p>
    </div>
  `,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          customClass: {
            popup: 'swal-popup-custom',
            confirmButton: 'swal-btn-confirm',
          },
          buttonsStyling: false,
        })

        abrirCarrito()
        return
      }

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

        <div class="limite-row total mt-2">
          <span class="label ">TOTAL</span>
          <span class="value highlight">$${format(total)}</span>
        </div>
      </div>

      <div class="metodos-wrapper mt-3 mb-4">
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
        // 📧 Generar y enviar ticket con PDF adjunto
        fetch('/api/generar-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedidoId: pedido.id, // 👈 SOLO el ID
            to: user.email, // 👈 Mail destino
            nombre: user.displayName, // 👈 Opcional
          }),
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
