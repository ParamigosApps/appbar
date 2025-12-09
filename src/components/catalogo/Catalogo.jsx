// --------------------------------------------------------------
// src/components/catalogo/Catalogo.jsx
// --------------------------------------------------------------
import { useCatalogo } from '../../context/CatalogoContext'

export default function Catalogo() {
  const {
    categorias,
    categoriaActiva,
    catalogoVisible,
    productosFiltrados,
    toggleCatalogo,
    seleccionarCategoria,
    abrirProductoDetalle,
  } = useCatalogo()

  return (
    <div className="d-grid gap-3">
      {/* VER CATÁLOGO COMPLETO */}
      <button
        className="btnCategorias btn btn-outline-dark w-100"
        onClick={toggleCatalogo}
      >
        Ver catálogo completo
      </button>

      {/* BOTONES CATEGORÍAS */}
      <div className="d-flex flex-wrap gap-2 mt-2">
        {categorias.map(cat => (
          <button
            key={cat}
            className={`btnCategorias btn btn-outline-secondary ${
              categoriaActiva === cat ? 'active' : ''
            }`}
            onClick={() => seleccionarCategoria(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* MENSAJE IGUAL AL ORIGINAL */}
      <div id="mensajeFiltro" className="text-start mt-3 text-muted">
        {!catalogoVisible
          ? 'Puedes filtrar los productos por categorías.'
          : categoriaActiva === 'Todos'
          ? '🔎 Mostrando: Catálogo completo'
          : `🔎 Filtrado por: ${categoriaActiva}`}
      </div>

      {/* CATÁLOGO */}
      {catalogoVisible && (
        <div id="catalogoContainer" className="container my-1">
          {productosFiltrados.length === 0 && (
            <p className="text-muted">No hay productos disponibles.</p>
          )}

          {productosFiltrados.map(p => (
            <div
              key={p.id}
              className={`product-card ${
                p.stock <= 0 ? 'producto-sin-stock' : ''
              }`}
              onClick={() => abrirProductoDetalle(p)}
            >
              <div className="product-info">
                <h3 className="product-description-title">{p.nombre}</h3>
                <p className="product-description">{p.descripcion}</p>
                <h5 className="product-price">${p.precio}</h5>
              </div>

              <div className="product-image">
                <img src={p.imgSrc} alt={p.nombre} />
              </div>

              {p.stock <= 0 && <span className="sin-stock">SIN STOCK</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
