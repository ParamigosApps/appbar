// --------------------------------------------------------------
// src/context/CatalogoContext.jsx
// --------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '../Firebase.js'

import { collection, getDocs } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { useCarrito } from './CarritoContext'

const CatalogoContext = createContext()
export const useCatalogo = () => useContext(CatalogoContext)

// ======================================================
// PRODUCTO (idéntico a tu JS original)
// ======================================================
class Producto {
  constructor(id, data) {
    this.id = id
    this.imgSrc = data.imagen || '/img/default-product.png'
    this.nombre = data.nombre || 'Sin título'
    this.descripcion = data.descripcion || 'Sin descripción'
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
  // CARGAR CATALOGO DESDE FIREBASE
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
  // ABRIR POPUP EXACTO AL ORIGINAL
  // ======================================================
  async function abrirProductoDetalle(producto) {
    // 🚨 Si no hay stock → NO ABRIR
    if (producto.stock <= 0) return

    const result = await Swal.fire({
      title: producto.nombre,
      html: `
      <img src="${producto.imgSrc}" style="width:150px;margin-bottom:10px;" />
      <p>${producto.descripcion}</p>
      <h5>Precio: $${producto.precio}</h5>

      <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:10px;">
        <button id="menos" class="btn-swal-cantidad">-</button>
        <input id="cantidad" type="number" class="swal2-input"
          value="1" min="1" max="${producto.stock}"
          style="width:70px;text-align:center;">
        <button id="mas" class="btn-swal-cantidad">+</button>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: 'Agregar al carrito',
      cancelButtonText: 'Cancelar',

      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-cancel',
      },
      buttonsStyling: false,

      didOpen: () => {
        const popup = Swal.getPopup()
        const input = popup.querySelector('#cantidad')
        const btnMas = popup.querySelector('#mas')
        const btnMenos = popup.querySelector('#menos')

        btnMas.addEventListener('click', () => {
          if (Number(input.value) < producto.stock) {
            input.value = Number(input.value) + 1
          }
        })

        btnMenos.addEventListener('click', () => {
          if (Number(input.value) > 1) {
            input.value = Number(input.value) - 1
          }
        })
      },

      preConfirm: () => {
        const cant = Number(document.getElementById('cantidad').value)

        if (cant < 1) return Swal.showValidationMessage('Cantidad inválida')
        if (cant > producto.stock)
          return Swal.showValidationMessage('No hay suficiente stock')

        return cant
      },
    })

    // ❌ Cancelado
    if (!result.isConfirmed) return

    // ✔ Guardamos cantidad seleccionada
    producto.enCarrito = result.value

    // ✔ Añadir al carrito con protección extra
    const respuesta = await agregarProducto(producto)

    if (respuesta === false) return

    // =====================================================
    // 🔥 Swal final: se cierra en 3s con progress bar
    // =====================================================
    const final = await Swal.fire({
      title: '¡Producto añadido!',
      html: `<p style="font-size:18px;font-weight:600;">${producto.nombre} x${producto.enCarrito} agregado 🛒</p>`,
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

      didOpen: () => {
        const bar = Swal.getTimerProgressBar()
        if (bar) bar.style.transition = 'width 3s linear'
      },
    })

    // Si elige "Ir al carrito"
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
  // PRODUCTOS FILTRADOS
  // ======================================================
  const productosFiltrados = useMemo(() => {
    if (!catalogoVisible) return []
    if (categoriaActiva === 'Todos') return productos
    return productos.filter(p => p.categoria === categoriaActiva)
  }, [productos, categoriaActiva, catalogoVisible])

  // ======================================================
  // TOGGLE CATALOGO COMPLETO
  // ======================================================
  function toggleCatalogo() {
    if (!catalogoVisible) {
      setCategoriaActiva('Todos')
      setCatalogoVisible(true)
    } else {
      setCatalogoVisible(false)
    }
  }

  // ======================================================
  // SELECCIONAR CATEGORÍA
  // ======================================================
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
