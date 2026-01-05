// --------------------------------------------------------------
// src/components/CarritoOverlay.jsx — VERSIÓN FINAL 2025
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

import { useCarrito } from '../context/CarritoContext.jsx'
import { usePedidos } from '../context/PedidosContext.jsx'

import './CarritoOverlay.css'
import PedidosSection from './pedidos/PedidosSection.jsx'

export default function CarritoOverlay() {
  const {
    carrito,
    panelAbierto,
    abrirCarrito,
    cerrarCarrito,
    sumarProducto,
    restarProducto,
    calcularTotal,
    finalizarCompra,
    format,
  } = useCarrito()

  const { pedidosPendientes, pedidosPagados } = usePedidos()
  const [verPedidos, setVerPedidos] = useState(false)
  const totalPedidos = pedidosPendientes.length + pedidosPagados.length

  useEffect(() => {
    const handler = () => {
      abrirCarrito()
    }

    document.addEventListener('abrir-carrito', handler)
    return () => document.removeEventListener('abrir-carrito', handler)
  }, [abrirCarrito])

  if (!panelAbierto) return null

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
                className="btn swal-btn-confirm"
                onClick={() => {
                  cerrarCarrito()

                  setTimeout(() => {
                    document.dispatchEvent(new Event('abrir-catalogo'))
                  }, 0)
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
                  <p>
                    Precio:{' '}
                    <span style={{ fontWeight: 700 }}>
                      ${format(p.precio)}{' '}
                    </span>
                    c/u
                  </p>

                  {/* =======================================================
                       CONTROLES DE CANTIDAD (— 1 +) — VERSIÓN FINAL
                     ======================================================= */}
                  <div className="carrito-cantidad-wrapper">
                    <button
                      className="btn-resta cantidad-btn menos"
                      onClick={() => restarProducto(index)}
                    >
                      –
                    </button>

                    <span className="carrito-cantidad-numero">
                      {p.enCarrito}
                    </span>

                    <button
                      className="btn-suma cantidad-btn mas"
                      onClick={() => sumarProducto(index)}
                    >
                      +
                    </button>
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

              <button
                id="btn-pedidos"
                type="button"
                className="swal-btn-confirm"
                onClick={finalizarCompra}
              >
                Confirmar pedido
              </button>
            </>
          )}

          {/* BOTÓN VER MIS PEDIDOS */}
          <button
            id="btn-pedidos"
            className={
              'btn swal-btn-alt btn-collapse ' + (verPedidos ? '' : 'collapsed')
            }
            type="button"
            onClick={() => setVerPedidos(v => !v)}
          >
            <strong>Tus pedidos</strong>
            <span
              className="
                badge bg-warning ms-2 rounded-circle d-inline-flex
                justify-content-center align-items-center
              "
              style={{
                color: '#000',
                fontWeight: '800',
                width: '24px',
                height: '24px',
                fontSize: '0.8rem',
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
