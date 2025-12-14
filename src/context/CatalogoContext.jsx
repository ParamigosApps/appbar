// --------------------------------------------------------------
// src/context/CatalogoContext.jsx — VERSIÓN FINAL 2025
// --------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '../Firebase.js'
import { collection, getDocs } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { useCarrito } from './CarritoContext'

const CatalogoContext = createContext()
export const useCatalogo = () => useContext(CatalogoContext)

// ======================================================
// PRODUCTO (idéntico al original, pero robusto)
// ======================================================
class Producto {
  constructor(id, data) {
    this.id = id
    this.imgSrc = data.imagen || '/img/default-product.png'
    this.nombre = data.nombre || 'Sin título'
    this.descripcion = data.descripcion || ''
    this.precio = data.precio || 0
    this.categoria = data.categoria || 'Sin categoría'
    this.destacado = data.destacado || false
    this.stock = data.stock ?? 0
    this.enCarrito = 1
  }
}

export function CatalogoProvider({ children }) {
  const [productos, setProductos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('Todos')
  const [catalogoVisible, setCatalogoVisible] = useState(false)

  const { agregarProducto, abrirCarrito } = useCarrito()

  // ======================================================
  // CARGAR CATÁLOGO DESDE FIREBASE
  // ======================================================
  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDocs(collection(db, 'productos'))
        const lista = snap.docs.map(doc => new Producto(doc.id, doc.data()))
        setProductos(lista)
      } catch (err) {
        console.error('Error cargando catálogo:', err)
      }
    }
    cargar()
  }, [])

  // ======================================================
  // MODAL DETALLE PRODUCTO — VERSIÓN FINAL CON ESTILOS OK
  // ======================================================
  async function abrirProductoDetalle(producto) {
    if (producto.stock <= 0) return

    const descripcionHtml = producto.descripcion
      ? `<p class="producto-desc text-muted">${producto.descripcion}</p>`
      : ''
    const result = await Swal.fire({
      title: producto.nombre,

      html: `
    <div class="swal-producto-detalle">
      <img src="${producto.imgSrc}" class="producto-img" />

    ${descripcionHtml}

      <h5 class="producto-precio">Precio: $${producto.precio}</h5>

      <div class="cantidad-row">
        <button id="menos" class="cantidad-btn menos">-</button>
        <div class="cantidad-input" id="cantidadBox">1</div>
        <button id="mas" class="cantidad-btn mas">+</button>
      </div>
    </div>
  `,

      showCancelButton: true,
      confirmButtonText: 'Agregar al carrito',
      cancelButtonText: 'Cancelar',

      customClass: {
        popup: 'swal-popup-custom swal-producto',
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-cancel',
      },

      buttonsStyling: false,

      didOpen: () => {
        const popup = Swal.getPopup()
        const box = popup.querySelector('#cantidadBox')
        const btnMas = popup.querySelector('#mas')
        const btnMenos = popup.querySelector('#menos')

        btnMas.onclick = () => {
          const val = Number(box.innerText)
          if (val < producto.stock) box.innerText = val + 1
        }

        btnMenos.onclick = () => {
          const val = Number(box.innerText)
          if (val > 1) box.innerText = val - 1
        }
      },

      preConfirm: () => {
        const cant = Number(document.getElementById('cantidadBox').innerText)
        if (cant < 1) {
          Swal.showValidationMessage('Cantidad inválida')
          return false
        }
        if (cant > producto.stock) {
          Swal.showValidationMessage('No hay suficiente stock')
          return false
        }
        return cant
      },
    })

    if (!result.isConfirmed) return

    producto.enCarrito = result.value

    const añadido = await agregarProducto(producto)
    if (!añadido) return

    const final = await Swal.fire({
      title: '¡Producto añadido!',
      html: `<p style="margin-top:4px;font-size:18px;font-weight:600;text-align:center;">${producto.nombre} x${producto.enCarrito} agregado.</p>`,
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Ir al carrito',
      cancelButtonText: 'Seguir comprando',

      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-cancel',
      },

      buttonsStyling: false,
      timer: 3000,
      timerProgressBar: true,
    })

    if (final.isConfirmed) abrirCarrito()
  }

  // ======================================================
  // CATEGORÍAS
  // ======================================================
  const categorias = useMemo(() => {
    const set = new Set(productos.map(p => p.categoria))
    return ['Todos', ...Array.from(set)]
  }, [productos])

  // ======================================================
  // FILTRADO
  // ======================================================
  const productosFiltrados = useMemo(() => {
    if (!catalogoVisible) return []
    if (categoriaActiva === 'Todos') return productos
    return productos.filter(p => p.categoria === categoriaActiva)
  }, [productos, categoriaActiva, catalogoVisible])

  // ======================================================
  // MOSTRAR / OCULTAR
  // ======================================================
  function toggleCatalogo() {
    if (!catalogoVisible) {
      setCategoriaActiva('Todos')
      setCatalogoVisible(true)
    } else {
      setCatalogoVisible(false)
    }
  }

  function seleccionarCategoria(cat) {
    setCategoriaActiva(cat)
    setCatalogoVisible(true)
  }

  return (
    <CatalogoContext.Provider
      value={{
        productos,
        categorias,
        categoriaActiva,
        catalogoVisible,
        productosFiltrados,
        abrirProductoDetalle,
        seleccionarCategoria,
        toggleCatalogo,
      }}
    >
      {children}
    </CatalogoContext.Provider>
  )
}
