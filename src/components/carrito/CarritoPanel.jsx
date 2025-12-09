// --------------------------------------------------------------
// src/components/carrito/CarritoPanel.jsx
// 🔥 Versión 100% idéntica al <aside id="carritoPanel"> del index.html
// --------------------------------------------------------------
import { useCarrito } from '../../context/CarritoContext.jsx'

export default function CarritoPanel() {
  const {
    carrito,
    panelAbierto,
    cerrarCarrito,
    sumarProducto,
    restarProducto,
    eliminarProducto,
    calcularTotal,
  } = useCarrito()

  return (
    <>
      {/* OVERLAY IDENTICO */}
      <div
        id="carritoOverlay"
        className={`carrito-overlay ${panelAbierto ? 'open' : ''}`}
        onClick={cerrarCarrito}
      ></div>

      {/* PANEL IDENTICO */}
      <aside
        id="carritoPanel"
        className={`carrito-panel ${panelAbierto ? 'open' : ''}`}
      >
        <div className="carrito-header d-flex justify-content-between align-items-center p-2 border-bottom">
          <h2 id="carritoTitulo">Tu pedido:</h2>
          <button
            id="cerrarCarrito"
            className="btn btn-light"
            onClick={cerrarCarrito}
          >
            ✕
          </button>
        </div>

        {/* TABLA ORIGINAL */}
        <table className="carrito-table w-100 mt-2 mb-1">
          <thead>
            <tr>
              <th className="DescripcionCarrito text-start">
                PRODUCTOS AÑADIDOS
              </th>
              <th className="DescripcionCarrito text-center">PRECIO</th>
              <th className="DescripcionCarrito">SUBTOTAL</th>
              <th className="DescripcionCarrito">ACCIONES</th>
            </tr>
          </thead>

          <tbody id="carritoItems" className="px-2 py-2">
            {carrito.length === 0 ? (
              <tr>
                <th
                  id="carritoItemsMensaje"
                  colSpan="4"
                  className="text-center text-muted"
                >
                  No hay productos en el carrito
                </th>
              </tr>
            ) : (
              carrito.map((p, i) => (
                <tr key={p.id} className="align-middle">
                  <td className="text-start">
                    <img
                      src={p.imgSrc}
                      alt={p.nombre}
                      className="img-producto-carrito me-2"
                    />
                    {p.nombre}
                  </td>

                  <td className="text-center">${p.precio}</td>

                  <td>${Number(p.precio) * p.enCarrito}</td>

                  <td>
                    <div className="btn-group">
                      <button
                        className="btn-resta"
                        onClick={() => restarProducto(i)}
                      >
                        –
                      </button>

                      <span className="mx-2">{p.enCarrito}</span>

                      <button
                        className="btn-suma"
                        onClick={() => sumarProducto(i)}
                      >
                        +
                      </button>

                      <button
                        className="btn btn-danger btn-sm ms-2"
                        onClick={() => eliminarProducto(i)}
                      >
                        X
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* FOOTER IDENTICO */}
        <div className="carrito-footer p-1 border-top d-flex justify-content-between align-items-center">
          <h3 className="MontoTotalCarritoH2 m-0">
            Total: <span id="MontoTotalCarrito">{calcularTotal()}</span>
          </h3>

          <button id="btnConfirmarPedido" className="btn btn-swal-estilo">
            Confirmar Pedido
          </button>
        </div>
      </aside>
    </>
  )
}
