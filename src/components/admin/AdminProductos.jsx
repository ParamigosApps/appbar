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
  actualizarStockProducto,
  actualizarCampoProducto,
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
  const [editStockId, setEditStockId] = useState(null)
  const [stockTemp, setStockTemp] = useState('')

  const [editPrecioId, setEditPrecioId] = useState(null)
  const [precioTemp, setPrecioTemp] = useState('')

  const [editCategoriaId, setEditCategoriaId] = useState(null)
  const [categoriaTemp, setCategoriaTemp] = useState('')

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
  async function guardarStockRapido(prodId) {
    const ok = await actualizarStockProducto(prodId, stockTemp)
    if (ok) {
      setEditStockId(null)
    } else {
      Swal.fire('Error', 'No se pudo actualizar el stock', 'error')
    }
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
            <option value="Sin alcohol">Sin alcohol</option>
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
          {/* SUBMIT */}
          <div className="form-divider my-4" />
          <div className="mt-1  d-flex justify-content-center">
            <button type="submit" className="btn swal-btn-confirm mb-4 mt-1">
              {editId ? 'Actualizar producto' : 'Guardar producto'}
            </button>
          </div>

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
        <h4 className="fw-bold mt-5 mb-4">Productos cargados</h4>

        {productos.length === 0 ? (
          <p className="text-muted">No hay productos todavía.</p>
        ) : (
          <div className="productos-list">
            {productos.map(prod => (
              <div key={prod.id} className="producto-row">
                {/* Imagen */}
                <div className="producto-col img">
                  <img
                    src={
                      prod.imagen ||
                      'https://via.placeholder.com/80x80?text=Img'
                    }
                    alt={prod.nombre}
                  />
                </div>

                {/* Nombre */}
                <div className="producto-col nombre">
                  <strong>{prod.nombre}</strong>
                  {prod.destacado && (
                    <span className="badge bg-warning text-dark ms-2">
                      Destacado
                    </span>
                  )}
                  <div className="text-muted small">
                    {prod.descripcion || 'Sin descripción'}
                  </div>
                </div>

                {/* META: categoría + stock + precio */}
                <div className="producto-side">
                  <div className="producto-meta">
                    {editCategoriaId === prod.id ? (
                      <select
                        className="form-select form-select-sm"
                        value={categoriaTemp}
                        autoFocus
                        onChange={async e => {
                          setCategoriaTemp(e.target.value)
                          await actualizarCampoProducto(prod.id, {
                            categoria: e.target.value,
                          })
                          setEditCategoriaId(null)
                        }}
                        onBlur={() => setEditCategoriaId(null)}
                      >
                        <option value="Tragos">Tragos</option>
                        <option value="Botellas">Botellas</option>
                        <option value="Sin alcohol">Sin alcohol</option>
                        <option value="Combos">Combos</option>
                        <option value="Promos">Promos</option>
                        <option value="Accesorios">Accesorios</option>
                      </select>
                    ) : (
                      <span
                        className="badge bg-info text-dark badge-editable"
                        onClick={() => {
                          setEditCategoriaId(prod.id)
                          setCategoriaTemp(prod.categoria)
                        }}
                      >
                        {prod.categoria} <small className="edit-icon">✎</small>
                      </span>
                    )}

                    {editStockId === prod.id ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        style={{ maxWidth: 70, textAlign: 'center' }}
                        value={stockTemp}
                        autoFocus
                        onChange={e => setStockTemp(e.target.value)}
                        onBlur={() => guardarStockRapido(prod.id)}
                      />
                    ) : (
                      <span
                        className={`badge badge-editable ${
                          prod.stock > 0 ? 'bg-success' : 'bg-danger'
                        }`}
                        onClick={() => {
                          setEditStockId(prod.id)
                          setStockTemp(prod.stock)
                        }}
                      >
                        {prod.stock} <small className="edit-icon">✎</small>
                      </span>
                    )}

                    {editPrecioId === prod.id ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        style={{ maxWidth: 90, textAlign: 'center' }}
                        value={precioTemp}
                        autoFocus
                        onChange={e => setPrecioTemp(e.target.value)}
                        onBlur={async () => {
                          await actualizarCampoProducto(prod.id, {
                            precio: Number(precioTemp),
                          })
                          setEditPrecioId(null)
                        }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            await actualizarCampoProducto(prod.id, {
                              precio: Number(precioTemp),
                            })
                            setEditPrecioId(null)
                          }
                          if (e.key === 'Escape') setEditPrecioId(null)
                        }}
                      />
                    ) : (
                      <span
                        className="producto-precio precio-editable"
                        onClick={() => {
                          setEditPrecioId(prod.id)
                          setPrecioTemp(prod.precio ?? 0)
                        }}
                        title="Editar precio"
                      >
                        {formatoPrecio(prod.precio)}
                        <small className="edit-icon">✎</small>
                      </span>
                    )}
                  </div>

                  <div className="producto-col acciones">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => onEditarProducto(prod)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onEliminarProducto(prod)}
                    >
                      Eliminar
                    </button>
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
