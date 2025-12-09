// --------------------------------------------------------------
// AdminProductos.jsx — Gestión de Productos (estilo CrearEvento)
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
  // ------------------------------------------------------------
  // STATE FORMULARIO
  // ------------------------------------------------------------
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

  // edición
  const [editId, setEditId] = useState(null)
  const [editImagenPath, setEditImagenPath] = useState(null)

  // listado
  const [productos, setProductos] = useState([])

  const MAX_DESC = 120

  // ------------------------------------------------------------
  // ESCUCHAR PRODUCTOS (real-time)
  // ------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = escucharProductos(lista => setProductos(lista))
    return () => unsubscribe && unsubscribe()
  }, [])

  // ------------------------------------------------------------
  // PREVIEW IMAGEN
  // ------------------------------------------------------------
  useEffect(() => {
    if (!imagenFile) {
      setPreviewImg(null)
      return
    }
    const url = URL.createObjectURL(imagenFile)
    setPreviewImg(url)
    return () => URL.revokeObjectURL(url)
  }, [imagenFile])

  // ------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // VALIDACIONES
  // ------------------------------------------------------------
  function validarFormulario() {
    const nombre = (form.nombre || '').trim()
    const descripcion = form.descripcion || ''
    const precio = Number(form.precio)
    const stock = Number(form.stock)
    const categoria = (form.categoria || '').trim()

    if (!nombre) {
      return { ok: false, msg: 'El nombre es obligatorio.' }
    }

    if (!categoria) {
      return { ok: false, msg: 'Seleccioná una categoría.' }
    }

    if (!Number.isFinite(precio) || precio < 0) {
      return { ok: false, msg: 'El precio debe ser un número válido.' }
    }

    if (!Number.isFinite(stock) || stock < 0) {
      return { ok: false, msg: 'El stock debe ser un número válido.' }
    }

    if (descripcion.length > MAX_DESC) {
      return {
        ok: false,
        msg: `La descripción no puede superar los ${MAX_DESC} caracteres.`,
      }
    }

    if (!editId && !imagenFile) {
      return { ok: false, msg: 'Subí una imagen para el producto.' }
    }

    return { ok: true }
  }

  // ------------------------------------------------------------
  // SUBMIT (CREAR / ACTUALIZAR)
  // ------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()

    const v = validarFormulario()
    if (!v.ok) {
      Swal.fire('Error', v.msg, 'error')
      return
    }

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
      // MODO EDICIÓN
      ok = await actualizarProducto(editId, datos, imagenFile, editImagenPath)
    } else {
      // MODO CREACIÓN
      ok = await crearProducto(datos, imagenFile)
    }

    if (ok) {
      Swal.fire(
        'Listo',
        editId ? 'Producto actualizado correctamente.' : 'Producto creado.',
        'success'
      )
      resetFormulario()
    } else {
      Swal.fire(
        'Error',
        editId
          ? 'No se pudo actualizar el producto.'
          : 'No se pudo crear el producto.',
        'error'
      )
    }
  }

  // ------------------------------------------------------------
  // EDITAR / ELIMINAR
  // ------------------------------------------------------------
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

    // subo un poco para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onEliminarProducto(prod) {
    const res = await Swal.fire({
      title: `¿Eliminar "${prod.nombre}"?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!res.isConfirmed) return

    const ok = await eliminarProducto(prod.id, prod.imagenPath || null)
    if (ok) {
      Swal.fire('Eliminado', 'El producto fue eliminado.', 'success')
    } else {
      Swal.fire('Error', 'No se pudo eliminar el producto.', 'error')
    }
  }

  // ------------------------------------------------------------
  // HELPERS VISUALES
  // ------------------------------------------------------------
  const descLen = form.descripcion.length
  let descClass = 'text-muted'
  if (descLen > MAX_DESC) {
    descClass = 'text-danger'
  } else if (descLen > MAX_DESC * 0.9) {
    descClass = 'text-warning'
  }

  function formatoPrecio(p) {
    const n = Number(p) || 0
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="container py-3">
      <h2 className="fw-bold mb-3">
        {editId ? 'Editar producto' : 'Añadir producto'}
      </h2>

      {/* ------------------- FORMULARIO ------------------- */}
      <form
        onSubmit={handleSubmit}
        className="border rounded p-3 shadow-sm mb-4"
      >
        {/* Nombre */}
        <label className="form-label fw-semibold">
          Nombre <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          name="nombre"
          className="form-control mb-3"
          placeholder="Ej: Fernet + Coca - 500cc"
          value={form.nombre}
          onChange={handleInput}
          required
        />

        {/* Precio */}
        <label className="form-label fw-semibold">
          Precio <span className="text-danger">*</span>
        </label>
        <input
          type="number"
          name="precio"
          className="form-control mb-3"
          placeholder="Ej: $10.000"
          value={form.precio}
          onChange={handleInput}
          min="0"
          step="1"
          required
        />

        {/* Descripción */}
        <label className="form-label fw-semibold">
          Descripción <span className="text-danger">*</span>
        </label>
        <textarea
          name="descripcion"
          className="form-control mb-1"
          rows="2"
          maxLength={200} // por las dudas, pero validamos con MAX_DESC
          placeholder="Descripción breve del producto (se mostrará en la tarjeta)"
          value={form.descripcion}
          onChange={handleInput}
          required
        />
        <div className="text-end mb-3">
          <small className={descClass}>
            {descLen}/{MAX_DESC} caracteres
          </small>
        </div>

        {/* Stock */}
        <label className="form-label fw-semibold">
          Stock <span className="text-danger">*</span>
        </label>
        <input
          type="number"
          name="stock"
          className="form-control mb-3"
          min="0"
          placeholder="Ej: 25"
          value={form.stock}
          onChange={handleInput}
          required
        />

        {/* Categoría */}
        <label className="form-label fw-semibold">
          Categoría <span className="text-danger">*</span>
        </label>
        <select
          name="categoria"
          className="form-select mb-3"
          value={form.categoria}
          onChange={handleInput}
          required
        >
          <option value="">Seleccionar categoría</option>
          <option value="Tragos">Tragos</option>
          <option value="Botellas">Botellas</option>
          <option value="Combos">Combos</option>
          <option value="Promos">Promos</option>
          <option value="Accesorios">Accesorios</option>
        </select>

        {/* Imagen */}
        <label className="form-label fw-semibold">
          Imagen{' '}
          {editId ? (
            '(opcional para cambiar)'
          ) : (
            <span className="text-danger">*</span>
          )}
        </label>
        <input
          type="file"
          className="form-control mb-2"
          accept="image/*"
          onChange={handleFileChange}
        />
        <small className="text-muted d-block mb-3">
          Recomendado 1200×675px. Peso máx aprox. 4–5MB.
        </small>

        {previewImg && (
          <div className="mb-3">
            <img
              src={previewImg}
              alt="Preview producto"
              className="img-fluid rounded"
              style={{ maxHeight: 180, objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Destacado */}
        <div className="form-check mb-3">
          <input
            type="checkbox"
            id="destacadoProducto"
            name="destacado"
            className="form-check-input"
            checked={form.destacado}
            onChange={handleInput}
          />
          <label className="form-check-label" htmlFor="destacadoProducto">
            Marcar como destacado
          </label>
        </div>

        {/* BOTONES */}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-success flex-fill">
            {editId ? 'Actualizar producto' : 'Guardar producto'}
          </button>
          {editId && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={resetFormulario}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      {/* ------------------- LISTA DE PRODUCTOS ------------------- */}
      <h4 className="fw-bold mb-3">Productos cargados</h4>

      {productos.length === 0 ? (
        <p className="text-muted">Todavía no hay productos registrados.</p>
      ) : (
        <div className="row g-3">
          {productos.map(prod => (
            <div key={prod.id} className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 shadow-sm">
                <div
                  style={{
                    height: 160,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f7f7f7',
                  }}
                >
                  <img
                    src={
                      prod.imagen ||
                      'https://via.placeholder.com/300x160?text=Sin+imagen'
                    }
                    alt={prod.nombre}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
                <div className="card-body d-flex flex-column">
                  {prod.destacado && (
                    <span className="badge bg-warning text-dark mb-2">
                      DESTACADO
                    </span>
                  )}

                  <h5 className="card-title">{prod.nombre}</h5>

                  <p className="small text-muted mb-1">
                    Categoría:{' '}
                    <span className="badge bg-info text-dark">
                      {prod.categoria || 'Sin categoría'}
                    </span>{' '}
                    — Stock:{' '}
                    <span className="badge bg-success text-white">
                      {prod.stock ?? 0}
                    </span>
                  </p>

                  <p className="small text-muted mb-2">
                    {prod.descripcion || 'Sin descripción'}
                  </p>

                  <div className="mb-3 text-muted">
                    Precio al público:{' '}
                    <span className="badge bg-primary">
                      {formatoPrecio(prod.precio)}
                    </span>
                  </div>

                  <div className="mt-auto d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm flex-fill"
                      onClick={() => onEditarProducto(prod)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
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
  )
}
