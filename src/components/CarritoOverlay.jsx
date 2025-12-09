// --------------------------------------------------------------
// src/components/CarritoOverlay.jsx — VERSIÓN FINAL AJUSTADA
// --------------------------------------------------------------
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useCarrito } from '../context/CarritoContext.jsx'
import { usePedidos } from '../context/PedidosContext.jsx'
import './CarritoOverlay.css'
import PedidosSection from './pedidos/PedidosSection.jsx'

export default function CarritoOverlay() {
  const {
    carrito,
    panelAbierto,
    cerrarCarrito,
    sumarProducto,
    restarProducto,
    calcularTotal,
    finalizarCompra,
    format,
  } = useCarrito()

  const { pedidosPendientes, pedidosPagados } = usePedidos()

  const [verPedidos, setVerPedidos] = useState(false)

  if (!panelAbierto) return null

  const totalPedidos = pedidosPendientes.length + pedidosPagados.length

  return createPortal(
    <div className="carrito-overlay open">
      <div className="carrito-backdrop" onClick={cerrarCarrito} />

      <div
        className="carrito-panel open"
        id="carritoPanel"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="carrito-header">
          <h4>Tu pedido:</h4>
          <button className="cerrar-btn" onClick={cerrarCarrito}>
            ✕
          </button>
        </div>

        {/* ITEMS */}
        <div className="carrito-items">
          {carrito.length === 0 ? (
            <div className="text-center mt-3">
              <p className="mb-3">Tu carrito está vacío 🛒</p>

              <button
                className="btn btn-dark"
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem',
                }}
                onClick={() => {
                  cerrarCarrito()

                  const btnCat = document.querySelector(
                    '[data-accordion-target="catalogo"]'
                  )
                  btnCat?.click()

                  const seccion = document.getElementById('accordion-catalogo')
                  if (seccion) {
                    setTimeout(() => {
                      seccion.scrollIntoView({ behavior: 'smooth' })
                    }, 300)
                  }
                }}
              >
                Ir al catálogo
              </button>
            </div>
          ) : (
            carrito.map((p, index) => (
              <div key={p.id || index} className="carrito-item">
                {p.imgSrc && <img src={p.imgSrc} alt={p.nombre} />}

                <div className="carrito-info">
                  <p>{p.nombre}</p>
                  <p>${format(p.precio)}</p>

                  <div className="carrito-controles">
                    <button onClick={() => restarProducto(index)}>-</button>
                    <span>{p.enCarrito}</span>
                    <button onClick={() => sumarProducto(index)}>+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="carrito-footer">
          {carrito.length > 0 && (
            <>
              <div className="carrito-total">
                <span>Total:</span>
                <strong>${format(calcularTotal())}</strong>
              </div>

              <button className="btn-finalizar" onClick={finalizarCompra}>
                Confirmar pedido
              </button>
            </>
          )}

          {/* BOTÓN VER MIS PEDIDOS */}
          <button
            className={
              'btn btn-outline-dark w-100 mt-3 btn-collapse ' +
              (verPedidos ? '' : 'collapsed')
            }
            type="button"
            onClick={() => {
              setVerPedidos(v => !v)
            }}
          >
            <strong>TUS PEDIDOS</strong>
            <span
              className="
                badge bg-dark ms-2 rounded-circle d-inline-flex 
                justify-content-center align-items-center
              "
              style={{
                width: '22px',
                height: '22px',
                fontSize: '0.75rem',
              }}
            >
              {totalPedidos}
            </span>
          </button>

          {verPedidos && (
            <div className="mt-2">
              <PedidosSection />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
