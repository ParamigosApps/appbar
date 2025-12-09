import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../Firebase.js'

import './Catalogo.css'

export default function CatalogoSection() {
  const [productos, setProductos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('Todos')

  // ======================================================
  // 🔥 TRAER PRODUCTOS DE FIRESTORE
  // ======================================================
  useEffect(() => {
    async function cargarProductos() {
      try {
        const snap = await getDocs(collection(db, 'productos'))
        const datos = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        console.log('🔥 Productos cargados:', datos) // <-- LOG VISUAL
        setProductos(datos)
      } catch (e) {
        console.error('❌ Error cargando productos:', e)
      }
    }

    cargarProductos()
  }, [])

  // ======================================================
  // 🔥 AGRUPAR POR CATEGORÍA
  // ======================================================
  const agrupar = lista => {
    const grupos = {}
    lista.forEach(p => {
      const cat = p.categoria || 'Otros'
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(p)
    })
    return grupos
  }

  const categorias = ['Todos', ...Object.keys(agrupar(productos))]

  const productosFiltrados = useMemo(() => {
    if (categoriaActiva === 'Todos') return productos
    return productos.filter(p => p.categoria === categoriaActiva)
  }, [productos, categoriaActiva])

  // ======================================================
  // 🔥 RENDER
  // ======================================================
  return (
    <div className="catalogo-wrapper">
      <h2 className="titulo-seccion">Catálogo</h2>

      {/* CATEGORÍAS */}
      <div className="categorias-grid">
        {categorias.map(cat => (
          <button
            key={cat}
            className={`cat-btn ${categoriaActiva === cat ? 'active' : ''}`}
            onClick={() => setCategoriaActiva(cat)}
          >
            {cat === 'Todos' ? 'Ver catálogo completo' : cat}
          </button>
        ))}
      </div>

      <p className="mensaje-filtro">
        Mostrando {productosFiltrados.length} productos
      </p>

      {/* PRODUCTOS */}
      <div className="productos-grid">
        {productosFiltrados.map(prod => (
          <div key={prod.id} className="producto-card">
            <img src={prod.imgUrl || '/img/no-img.png'} alt={prod.nombre} />

            <h3>{prod.nombre}</h3>
            <p className="prod-desc">{prod.descripcion}</p>
            <p className="prod-precio">${prod.precio}</p>

            <button className="btn-agregar">Agregar</button>
          </div>
        ))}

        {productosFiltrados.length === 0 && (
          <p>No hay productos en esta categoría.</p>
        )}
      </div>
    </div>
  )
}
