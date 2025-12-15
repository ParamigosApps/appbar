// --------------------------------------------------------------
// EditarEvento.jsx — Edición dentro del Panel Admin (sin routing)
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import {
  subirImagenEvento,
  editarEvento,
  obtenerEventoPorId,
} from '../../services/eventosAdmin.js'
import Swal from 'sweetalert2'

// TipTap
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
export default function EditarEvento({ editarId, setSeccion }) {
  const [cargando, setCargando] = useState(true)

  const [form, setForm] = useState({
    nombre: '',
    fecha: '',
    horarioDesde: '',
    horarioHasta: '',
    lugar: '',
    precio: 0,
    entradasMaximas: '',
    entradasPorUsuario: 4,
  })

  const [imagen, setImagen] = useState(null)
  const [previewImg, setPreviewImg] = useState(null)

  const [descripcionHtml, setDescripcionHtml] = useState('')
  const [descripcionPlano, setDescripcionPlano] = useState('')

  const [lotes, setLotes] = useState([])
  const MAX_DESC = 180

  // --------------------------------------------------------------
  // TIPTAP
  // --------------------------------------------------------------
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate({ editor }) {
      const fullText = editor.getText() || ''
      if (fullText.length <= MAX_DESC) {
        setDescripcionPlano(fullText)
        setDescripcionHtml(editor.getHTML())
      } else {
        const truncated = fullText.slice(0, MAX_DESC)
        setDescripcionPlano(truncated)
        setDescripcionHtml(truncated)
      }
    },
  })

  // --------------------------------------------------------------
  // 1) CARGAR EVENTO EXISTENTE
  // --------------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      if (!editarId) {
        Swal.fire('Error', 'No se recibió ID del evento.', 'error')
        setSeccion('eventos-lista')
        return
      }

      const data = await obtenerEventoPorId(editarId)
      if (!data) {
        Swal.fire('Error', 'Evento no encontrado.', 'error')
        setSeccion('eventos-lista')
        return
      }

      // Extraer horarios del texto
      let desde = ''
      let hasta = ''
      data.fecha

      setForm({
        nombre: data.nombre,
        fecha: data.fecha,
        horarioDesde: desde,
        horarioHasta: hasta,
        horario: `Desde ${form.horarioDesde}hs hasta ${form.horarioHasta}hs.`,
        lugar: data.lugar,
        precio: data.precio || 0,
        entradasMaximas: data.entradasMaximasEvento || '',
        entradasPorUsuario: data.entradasPorUsuario || 1,
      })

      setPreviewImg(data.imagenEventoUrl || null)
      setDescripcionHtml(data.descripcion || '')
      setDescripcionPlano(data.descripcion || '')

      editor?.commands.setContent(data.descripcion || '')

      setLotes(
        Array.isArray(data.lotes)
          ? data.lotes.map((l, idx) => ({
              id: idx + '-' + Date.now(),
              ...l,
            }))
          : []
      )

      setCargando(false)
    }

    cargar()
  }, [editarId, editor, setSeccion])

  // --------------------------------------------------------------
  // INPUTS
  // --------------------------------------------------------------
  function handleInput(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // --------------------------------------------------------------
  // PREVIEW IMG
  // --------------------------------------------------------------
  useEffect(() => {
    if (!imagen) return
    const url = URL.createObjectURL(imagen)
    setPreviewImg(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])

  // --------------------------------------------------------------
  // VALIDACIONES
  // --------------------------------------------------------------
  function validarHorario(h) {
    if (!h) return true
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(h)
  }

  function validarImagen(file) {
    if (!file) return true
    const formatos = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    const maxSize = 5 * 1024 * 1024

    if (!formatos.includes(file.type)) {
      Swal.fire('Error', 'La imagen debe ser JPG, PNG o WEBP.', 'error')
      return false
    }
    if (file.size > maxSize) {
      Swal.fire('Error', 'La imagen no debe superar los 5MB.', 'error')
      return false
    }
    return true
  }

  function validarLotes(maxCap) {
    const total = lotes.reduce((a, l) => a + (Number(l.cantidad) || 0), 0)
    if (total > maxCap) {
      Swal.fire(
        'Capacidad excedida',
        `Los lotes suman ${total}, mayor al máximo ${maxCap}.`,
        'error'
      )
      return false
    }
    return true
  }

  // --------------------------------------------------------------
  // LOTES
  // --------------------------------------------------------------
  function agregarLote() {
    setLotes(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        nombre: '',
        genero: 'todos',
        precio: '',
        cantidad: '',
        desdeHora: '',
        hastaHora: '',
        incluyeConsumicion: false,
      },
    ])
  }

  function actualizarLote(id, campo, valor) {
    setLotes(prev =>
      prev.map(l => (l.id === id ? { ...l, [campo]: valor } : l))
    )
  }

  function eliminarLote(id) {
    setLotes(prev => prev.filter(l => l.id !== id))
  }

  // --------------------------------------------------------------
  // SUBMIT
  // --------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nombre || !form.fecha || !form.lugar) {
      Swal.fire('Error', 'Completá nombre, fecha y lugar.', 'error')
      return
    }

    if (
      !validarHorario(form.horarioDesde) ||
      !validarHorario(form.horarioHasta)
    ) {
      Swal.fire('Error', 'Horario inválido (HH:MM).', 'error')
      return
    }

    if (!validarImagen(imagen)) return

    const max = Number(form.entradasMaximas)
    if (!validarLotes(max)) return

    const data = {
      nombre: form.nombre,
      fecha: form.fecha,
      lugar: form.lugar,
      horario: `Desde ${form.horarioDesde || '-'}hs hasta ${
        form.horarioHasta || '-'
      }hs.`,
      precio: Number(form.precio) || 0,
      descripcion: descripcionHtml,
      entradasMaximasEvento: max,
      entradasPorUsuario: Number(form.entradasPorUsuario) || 1,
      lotes: lotes.map(l => ({
        nombre: (l.nombre || '').trim(),
        genero: l.genero || 'todos',
        precio: Number(l.precio) || 0,
        cantidad: Number(l.cantidad) || 0,
        desdeHora: l.desdeHora || '',
        hastaHora: l.hastaHora || '',
        incluyeConsumicion: !!l.incluyeConsumicion,
      })),
    }

    const ok = await editarEvento(editarId, data, imagen)
    if (ok) {
      Swal.fire('Listo', 'Evento actualizado correctamente.', 'success')
      setSeccion('eventos-lista')
    } else {
      Swal.fire('Error', 'No se pudo actualizar.', 'error')
    }
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  if (cargando) return <p className="p-3">Cargando evento...</p>

  return (
    <div className="container py-3">
      <button
        className="btn btn-outline-secondary mb-3"
        onClick={() => setSeccion('eventos-lista')}
      >
        ← Volver
      </button>

      <h2 className="fw-bold mb-3">Editar Evento</h2>

      <form onSubmit={handleSubmit} className="border rounded p-3 shadow-sm">
        {/* ------------------- Nombre ------------------- */}
        <label className="fw-semibold">Nombre del evento*</label>
        <input
          type="text"
          name="nombre"
          className="form-control mb-3"
          value={form.nombre}
          onChange={handleInput}
        />

        {/* ------------------- Horarios ------------------- */}
        <label className="fw-semibold">Inicio del evento*</label>
        <input
          type="date"
          name="fechaInicio"
          className="form-control mb-2"
          value={form.fechaInicio}
          onChange={handleInput}
        />

        <input
          type="time"
          name="horaInicio"
          className="form-control mb-3"
          value={form.horaInicio}
          onChange={handleInput}
        />

        <label className="fw-semibold">Fin del evento*</label>
        <input
          type="date"
          name="fechaFin"
          className="form-control mb-2"
          value={form.fechaFin}
          onChange={handleInput}
        />

        <input
          type="time"
          name="horaFin"
          className="form-control mb-3"
          value={form.horaFin}
          onChange={handleInput}
        />

        {/* ------------------- Lugar ------------------- */}
        <label className="fw-semibold">Lugar*</label>
        <input
          type="text"
          name="lugar"
          className="form-control mb-3"
          value={form.lugar}
          onChange={handleInput}
        />

        {/* ------------------- Precio base ------------------- */}
        <label className="fw-semibold">Precio base</label>
        <input
          type="number"
          name="precio"
          className="form-control mb-3"
          value={form.precio}
          onChange={handleInput}
        />

        {/* ------------------- Capacidad ------------------- */}
        <label className="fw-semibold">Capacidad total*</label>
        <input
          type="number"
          name="entradasMaximas"
          className="form-control mb-3"
          value={form.entradasMaximas}
          onChange={handleInput}
        />

        {/* ------------------- Máximo por usuario ------------------- */}
        <label className="fw-semibold">Máximo por usuario</label>
        <input
          type="number"
          name="entradasPorUsuario"
          className="form-control mb-3"
          value={form.entradasPorUsuario}
          onChange={handleInput}
        />

        {/* ------------------- Imagen ------------------- */}
        <label className="fw-semibold">Imagen del evento</label>
        <input
          type="file"
          accept="image/*"
          className="form-control mb-3"
          onChange={e => setImagen(e.target.files[0])}
        />

        {previewImg && (
          <img
            src={previewImg}
            className="img-fluid mb-3 rounded"
            style={{ maxHeight: 180, objectFit: 'cover' }}
          />
        )}

        {/* ------------------- Descripción ------------------- */}
        <label className="fw-semibold">Descripción corta</label>
        <div className="border rounded p-2 mb-1" style={{ minHeight: 150 }}>
          <EditorContent editor={editor} />
        </div>
        <small className="text-end text-muted d-block mb-3">
          {descripcionPlano.length}/{MAX_DESC}
        </small>

        {/* ------------------- LOTES ------------------- */}
        <hr />
        <h5 className="fw-bold">Lotes</h5>

        <button
          type="button"
          className="btn btn-outline-dark mb-3"
          onClick={agregarLote}
        >
          ➕ Agregar lote
        </button>

        {lotes.map(lote => (
          <div key={lote.id} className="border rounded p-2 mb-5 bg-light">
            <div className="d-flex justify-content-between mb-2">
              <strong>{lote.nombre || 'Lote sin nombre'}</strong>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => eliminarLote(lote.id)}
              >
                Eliminar
              </button>
            </div>

            <div className="row g-2 mb-2">
              {/* Nombre */}
              <div className="col-md-4">
                <label className="form-label small m-0">
                  Nombre del lote <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ej: Preventa 1, Ladies Night, Early Bird..."
                  value={lote.nombre}
                  onChange={e =>
                    actualizarLote(lote.id, 'nombre', e.target.value)
                  }
                  required
                />
              </div>

              {/* Descripción */}
              <div className="col-md-4">
                <label className="form-label small m-0">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ej: Ingreso hasta 01:30, acceso preferencial..."
                  value={lote.descripcion}
                  onChange={e =>
                    actualizarLote(lote.id, 'descripcion', e.target.value)
                  }
                />
              </div>

              {/* Precio */}
              <div className="col-md-2">
                <label className="form-label small m-0">
                  Precio <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="Ej: 3000"
                  value={lote.precio}
                  onChange={e =>
                    actualizarLote(lote.id, 'precio', e.target.value)
                  }
                  required
                />
              </div>

              {/* Cantidad */}
              <div className="col-md-2">
                <label className="form-label small m-0">
                  Límite de entradas <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="Ej: 50"
                  value={lote.cantidad}
                  onChange={e =>
                    actualizarLote(lote.id, 'cantidad', e.target.value)
                  }
                  required
                />
              </div>
            </div>

            {/* Segunda fila */}
            <div className="row g-2 mb-2">
              {/* Género */}
              <div className="col-md-4">
                <label className="form-label small m-0">
                  Género <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  value={lote.genero}
                  onChange={e =>
                    actualizarLote(lote.id, 'genero', e.target.value)
                  }
                  required
                >
                  <option value="todos">Todos</option>
                  <option value="hombres">Hombres</option>
                  <option value="mujeres">Mujeres</option>
                </select>
              </div>

              {/* Ingreso permitido desde–hasta */}
              <div className="col-md-4">
                <label className="form-label small m-0">
                  Ingreso permitido <span style={{ color: 'red' }}>*</span>
                </label>

                <div className="d-flex align-items-center gap-1">
                  <span className="small">Desde:</span>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ minWidth: '65px' }}
                    placeholder="23:30"
                    value={lote.desdeHora}
                    onChange={e =>
                      actualizarLote(lote.id, 'desdeHora', e.target.value)
                    }
                    required
                  />

                  <span className="small">Hasta:</span>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ minWidth: '65px' }}
                    placeholder="01:30"
                    value={lote.hastaHora}
                    onChange={e =>
                      actualizarLote(lote.id, 'hastaHora', e.target.value)
                    }
                    required
                  />
                </div>
              </div>

              {/* Consumición */}
              <div className="col-md-4 d-flex align-items-end">
                <div className="form-check ms-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={lote.incluyeConsumicion}
                    onChange={e =>
                      actualizarLote(
                        lote.id,
                        'incluyeConsumicion',
                        e.target.checked
                      )
                    }
                  />
                  <label className="form-check-label small">
                    Incluye consumición
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button className="btn btn-primary w-100" type="submit">
          Guardar cambios
        </button>
      </form>
    </div>
  )
}
