// --------------------------------------------------------------
// AdminProductos.jsx — Versión PRO + Responsive + Layout Aislado
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import {
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  escucharProductos,
} from '../../services/productosAdmin.js'

export default function AdminProductos() {
  const [form, setForm] = useState({
    nombre: '',
    precio: '',
    descripcion: '',
    categoria: '',
    stock: '',
    destacado: false,
  })

  const [imagenFile, setImagenFile] = useState(null)
  const [previewImg, setPreviewImg] = useState(null)

  const [editId, setEditId] = useState(null)
  const [editImagenPath, setEditImagenPath] = useState(null)

  const [productos, setProductos] = useState([])

  const MAX_DESC = 120

  useEffect(() => {
    const unsubscribe = escucharProductos(lista => setProductos(lista))
    return () => unsubscribe && unsubscribe()
  }, [])

  useEffect(() => {
    if (!imagenFile) {
      setPreviewImg(null)
      return
    }
    const url = URL.createObjectURL(imagenFile)
    setPreviewImg(url)
    return () => URL.revokeObjectURL(url)
  }, [imagenFile])

  function handleInput(e) {
    const { name, type, value, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    setImagenFile(file)
  }

  function resetFormulario() {
    setForm({
      nombre: '',
      precio: '',
      descripcion: '',
      categoria: '',
      stock: '',
      destacado: false,
    })
    setImagenFile(null)
    setPreviewImg(null)
    setEditId(null)
    setEditImagenPath(null)
  }

  function validarFormulario() {
    const nombre = (form.nombre || '').trim()
    const descripcion = form.descripcion || ''
    const precio = Number(form.precio)
    const stock = Number(form.stock)
    const categoria = (form.categoria || '').trim()

    if (!nombre) return { ok: false, msg: 'El nombre es obligatorio.' }
    if (!categoria) return { ok: false, msg: 'Seleccioná una categoría.' }
    if (!Number.isFinite(precio) || precio < 0)
      return { ok: false, msg: 'Precio inválido.' }
    if (!Number.isFinite(stock) || stock < 0)
      return { ok: false, msg: 'Stock inválido.' }
    if (descripcion.length > MAX_DESC)
      return { ok: false, msg: `Máximo ${MAX_DESC} caracteres.` }

    if (!editId && !imagenFile) return { ok: false, msg: 'Subí una imagen.' }

    return { ok: true }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const v = validarFormulario()
    if (!v.ok) return Swal.fire('Error', v.msg, 'error')

    const datos = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio: form.precio,
      categoria: form.categoria,
      stock: form.stock,
      destacado: form.destacado,
    }

    let ok = false

    if (editId) {
      ok = await actualizarProducto(editId, datos, imagenFile, editImagenPath)
    } else {
      ok = await crearProducto(datos, imagenFile)
    }

    if (ok) {
      Swal.fire(
        'Listo',
        editId ? 'Producto actualizado.' : 'Producto creado!',
        'success'
      )
      resetFormulario()
    } else {
      Swal.fire('Error', 'No se pudo guardar el producto.', 'error')
    }
  }

  function onEditarProducto(prod) {
    setForm({
      nombre: prod.nombre || '',
      precio: prod.precio ?? '',
      descripcion: prod.descripcion || '',
      categoria: prod.categoria || '',
      stock: prod.stock ?? '',
      destacado: !!prod.destacado,
    })
    setEditId(prod.id)
    setEditImagenPath(prod.imagenPath || null)
    setPreviewImg(prod.imagen || null)
    setImagenFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onEliminarProducto(prod) {
    const res = await Swal.fire({
      title: `¿Eliminar "${prod.nombre}"?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
    })

    if (!res.isConfirmed) return

    const ok = await eliminarProducto(prod.id, prod.imagenPath || null)
    if (ok) Swal.fire('Eliminado', 'Producto eliminado.', 'success')
    else Swal.fire('Error', 'No se pudo eliminar.', 'error')
  }

  const descLen = form.descripcion.length
  const descClass =
    descLen > MAX_DESC
      ? 'text-danger'
      : descLen > MAX_DESC * 0.9
      ? 'text-warning'
      : 'text-muted'

  function formatoPrecio(p) {
    const n = Number(p) || 0
    return n.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
    })
  }

  return (
    <div className="productos-admin-page">
      <div className="productos-admin-container">
        <h2 className="fw-bold mb-3 text-center">
          {editId ? 'Editar producto' : 'Añadir producto'}
        </h2>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="producto-form shadow-sm">
          {/* Nombre */}
          <label className="form-label fw-semibold">
            Nombre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            name="nombre"
            className="form-control mb-3"
            value={form.nombre}
            onChange={handleInput}
            required
          />

          {/* Precio */}
          <label className="form-label fw-semibold">Precio *</label>
          <input
            type="number"
            name="precio"
            className="form-control mb-3"
            value={form.precio}
            onChange={handleInput}
            required
          />

          {/* Descripción */}
          <label className="form-label fw-semibold">Descripción *</label>
          <textarea
            name="descripcion"
            className="form-control mb-1"
            rows="2"
            value={form.descripcion}
            onChange={handleInput}
            required
          />
          <div className="text-end mb-3">
            <small className={descClass}>
              {descLen}/{MAX_DESC}
            </small>
          </div>

          {/* Stock */}
          <label className="form-label fw-semibold">Stock *</label>
          <input
            type="number"
            name="stock"
            className="form-control mb-3"
            value={form.stock}
            onChange={handleInput}
            required
          />

          {/* Categoría */}
          <label className="form-label fw-semibold">Categoría *</label>
          <select
            name="categoria"
            className="form-select mb-3"
            value={form.categoria}
            onChange={handleInput}
            required
          >
            <option value="">Elegir...</option>
            <option value="Tragos">Tragos</option>
            <option value="Botellas">Botellas</option>
            <option value="Combos">Combos</option>
            <option value="Promos">Promos</option>
            <option value="Accesorios">Accesorios</option>
          </select>

          {/* Imagen */}
          <label className="form-label fw-semibold">Imagen *</label>
          <input
            type="file"
            className="form-control mb-2"
            accept="image/*"
            onChange={handleFileChange}
          />

          {previewImg && (
            <img
              src={previewImg}
              className="img-fluid rounded mb-3"
              style={{ maxHeight: 180, objectFit: 'cover' }}
            />
          )}
          <label className="form-label fw-semibold mt-2">
            ¿Producto destacado?
          </label>
          <div className="form-check mb-3">
            <input
              type="checkbox"
              id="destacado"
              name="destacado"
              className="form-check-input"
              checked={form.destacado}
              onChange={handleInput}
            />
            <label htmlFor="destacado" className="form-check-label">
              Marcar como destacado
            </label>
          </div>

          <button type="submit" className="btn btn-success w-100">
            {editId ? 'Actualizar producto' : 'Guardar producto'}
          </button>

          {editId && (
            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-2"
              onClick={resetFormulario}
            >
              Cancelar edición
            </button>
          )}
        </form>

        {/* LISTA DE PRODUCTOS */}
        <h4 className="fw-bold mt-4">Productos cargados</h4>

        {productos.length === 0 ? (
          <p className="text-muted">No hay productos todavía.</p>
        ) : (
          <div className="productos-grid">
            {productos.map(prod => (
              <div key={prod.id} className="producto-card card shadow-sm">
                <div className="producto-img">
                  <img
                    src={
                      prod.imagen ||
                      'https://via.placeholder.com/300x160?text=Sin+imagen'
                    }
                    alt={prod.nombre}
                  />
                </div>

                <div className="card-body d-flex flex-column">
                  {prod.destacado && (
                    <span className="badge bg-warning text-dark mb-2">
                      DESTACADO
                    </span>
                  )}

                  <h5>{prod.nombre}</h5>

                  <p className="small text-muted mb-1">
                    Cat:{' '}
                    <span className="badge bg-info text-dark">
                      {prod.categoria}
                    </span>{' '}
                    — Stock:{' '}
                    <span className="badge bg-success">{prod.stock}</span>
                  </p>

                  <p className="small text-muted">
                    {prod.descripcion || 'Sin descripción'}
                  </p>

                  <div className="mt-auto">
                    <div className="badge bg-primary mb-2">
                      {formatoPrecio(prod.precio)}
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-primary btn-sm flex-fill"
                        onClick={() => onEditarProducto(prod)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm flex-fill"
                        onClick={() => onEliminarProducto(prod)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
