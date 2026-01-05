// --------------------------------------------------------------
// src/context/CatalogoContext.jsx — VERSIÓN FINAL 2025
// --------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '../Firebase.js'
import { collection, getDocs } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { useCarrito } from './CarritoContext'
import { useEvento } from './EventosContext.jsx' // 👈 SINGULAR

const CatalogoContext = createContext(null)

// 🔑 HOOK DESPUÉS
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
  const [totalFirestore, setTotalFirestore] = useState(0)
  const { agregarProducto, abrirCarrito } = useCarrito()
  const { evento, seleccionarEvento, validarEventoVigente } = useEvento()
  // ======================================================
  // CARGAR CATÁLOGO DESDE FIREBASE SIN MOSTRAR
  // ======================================================

  async function cargarCatalogo() {
    try {
      const snap = await getDocs(collection(db, 'productos'))
      console.log('📦 productos firestore:', snap.size)
      const lista = snap.docs.map(doc => new Producto(doc.id, doc.data()))
      setProductos(lista)
    } catch (err) {
      console.error('Error cargando catálogo:', err)
    }
  }

  useEffect(() => {
    cargarCatalogo()
  }, [])

  // ======================================================
  // MODAL DETALLE PRODUCTO — VERSIÓN FINAL CON ESTILOS OK
  // ======================================================
  async function abrirProductoDetalle(producto) {
    if (producto.stock <= 0) return

    if (!evento) {
      await Swal.fire({
        title: 'Evento requerido',
        text: 'Seleccioná un evento antes de agregar productos.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          confirmButton: 'swal-btn-confirm',
        },
        buttonsStyling: false,
      })
      return
    }

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

  async function toggleCatalogo() {
    // 1️⃣ No hay evento seleccionado
    if (!evento) {
      const ok = await pedirEventoAntesDeCatalogo()
      if (!ok) return // ⛔ BLOQUEO TOTAL
    } else {
      // 2️⃣ Evento seleccionado pero puede haber vencido
      const vigente = await validarEventoVigente()

      if (!vigente) {
        const ok = await pedirEventoAntesDeCatalogo()
        if (!ok) return // ⛔ BLOQUEO TOTAL
      }
    }

    setCatalogoVisible(v => !v)
  }

  async function pedirEventoAntesDeCatalogo() {
    const snap = await getDocs(collection(db, 'eventos'))
    const ahora = new Date()

    // Normalizar y filtrar vigentes
    const eventosVigentes = snap.docs
      .map(d => {
        const data = d.data()

        const inicio = data.fechaInicio?.toDate
          ? data.fechaInicio.toDate()
          : data.fechaInicio
          ? new Date(data.fechaInicio)
          : null

        const fin = data.fechaFin?.toDate
          ? data.fechaFin.toDate()
          : data.fechaFin
          ? new Date(data.fechaFin)
          : null

        let vigente = false

        if (inicio && fin) {
          vigente = inicio <= ahora && ahora <= fin
        } else if (inicio) {
          // válido solo el día del evento
          vigente = inicio.toDateString() === ahora.toDateString()
        }

        return {
          id: d.id,
          ...data,
          inicio,
          vigente,
        }
      })
      .filter(ev => ev.vigente)

    if (!eventosVigentes.length) {
      await Swal.fire({
        title: 'Sin eventos activos',
        html: `
    <p style="font-size:15px">
      En este momento no hay ningún evento vigente.<br/>
      El catálogo solo está disponible durante eventos activos.
    </p>
  `,
        icon: 'info',
        confirmButtonText: 'Entendido',
        customClass: { confirmButton: 'swal-btn-confirm' },
        buttonsStyling: false,
      })

      return false
    }

    // Ordenar por fecha (más cercano primero)
    eventosVigentes.sort((a, b) => a.inicio - b.inicio)

    let html = `
    <div style="margin-bottom:12px;font-size:15px">
      ¿En que evento te encuentras?
    </div>
    <select id="evento-select" class="swal2-select" style="width:100%;padding:12px">
  `

    eventosVigentes.forEach((ev, i) => {
      html += `
    <option value="${ev.id}" ${i === 0 ? 'selected' : ''}>
      ${formatearEventoHumano(ev.inicio)} – ${ev.nombre}
    </option>
  `
    })

    html += '</select>'

    const res = await Swal.fire({
      title: 'Elige tu evento',
      html,
      confirmButtonText: 'Continuar',
      allowOutsideClick: false,
      buttonsStyling: false,
      customClass: {
        popup: 'swal-select-evento',
        confirmButton: 'swal-btn-confirm',
      },
      preConfirm: () => {
        const el = document.getElementById('evento-select')
        return el?.value || false
      },
    })

    if (!res.value) return false

    const ev = eventosVigentes.find(e => e.id === res.value)
    if (!ev) return false

    seleccionarEvento({
      id: ev.id,
      nombre: ev.nombre,
      fechaInicio: ev.fechaInicio || null,
      horaInicio: ev.horaInicio || null,
    })

    return true
  }

  async function seleccionarCategoria(cat) {
    try {
      const snap = await getDocs(collection(db, 'productos'))

      if (snap.size !== productos.length) {
        console.warn('🔄 Catálogo desactualizado, recargando')
        const lista = snap.docs.map(doc => new Producto(doc.id, doc.data()))
        setProductos(lista)
        setTotalFirestore(lista.length)
      }
    } catch (e) {
      console.error('Error validando catálogo', e)
    }

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

function formatearEventoHumano(fecha) {
  if (!fecha) return ''

  const hoy = new Date()
  const esHoy = fecha.toDateString() === hoy.toDateString()

  const fechaTexto = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const capitalizado = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)

  return `${esHoy ? 'HOY – ' : ''}${capitalizado}`
}
