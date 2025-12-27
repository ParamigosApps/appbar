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
    fechaInicio: '',
    horaInicio: '',
    fechaFin: '',
    horaFin: '',
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

  function toInputDate(value) {
    if (!value) return ''

    // Firestore Timestamp
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toISOString().slice(0, 10)
    }

    // Date
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10)
    }

    // String YYYY-MM-DD
    if (typeof value === 'string') {
      return value
    }

    return ''
  }

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

      data.fecha

      setForm({
        nombre: data.nombre || '',

        fechaInicio: toInputDate(data.fechaInicio),
        horaInicio: data.horaInicio || '',

        fechaFin: toInputDate(data.fechaFin),
        horaFin: data.horaFin || '',

        lugar: data.lugar || '',
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
          ? data.lotes.map((l, idx) => {
              const cantidadInicial = Number(
                l.cantidadInicial ?? l.cantidad ?? 0
              )

              return {
                id: idx + '-' + Date.now(),
                ...l,
                cantidadInicial,
                cantidad: Number(l.cantidad ?? cantidadInicial),
                _originalCantidadInicial: cantidadInicial,
              }
            })
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
        maxPorUsuario: 0,
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

  function validarLotesEditados() {
    for (const l of lotes) {
      const vendidas = l._originalCantidadInicial - l.cantidad

      if (l.cantidadInicial < vendidas) {
        Swal.fire(
          'Error',
          `El lote "${l.nombre}" no puede tener menos capacidad que entradas ya vendidas (${vendidas}).`,
          'error'
        )
        return false
      }
    }
    return true
  }

  // --------------------------------------------------------------
  // SUBMIT
  // --------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()

    if (
      !form.nombre ||
      !form.fechaInicio ||
      !form.horaInicio ||
      !form.fechaFin ||
      !form.horaFin ||
      !form.lugar
    ) {
      Swal.fire('Error', 'Completá nombre, fecha y lugar.', 'error')
      return
    }

    if (!validarLotesEditados()) return

    if (!validarImagen(imagen)) return

    const max = Number(form.entradasMaximas)
    if (!validarLotes(max)) return

    const data = {
      nombre: form.nombre,
      lugar: form.lugar,
      precio: Number(form.precio) || 0,
      descripcion: descripcionHtml,

      fechaInicio: form.fechaInicio,
      horaInicio: form.horaInicio,
      fechaFin: form.fechaFin,
      horaFin: form.horaFin,

      entradasMaximasEvento: max,
      entradasPorUsuario: Number(form.entradasPorUsuario) || 1,

      lotes: lotes.map(l => ({
        nombre: (l.nombre || '').trim(),
        descripcion: (l.descripcion || '').trim(),
        genero: l.genero || 'todos',
        precio: Number(l.precio) || 0,

        cantidadInicial: Number(l.cantidadInicial) || 0,
        cantidad: Number(l.cantidad) || 0,

        desdeHora: l.desdeHora || '',
        hastaHora: l.hastaHora || '',
        incluyeConsumicion: !!l.incluyeConsumicion,
        maxPorUsuario: Number(l.maxPorUsuario) || 4,
      })),
    }

    const ok = await editarEvento(editarId, data, imagen)
    if (ok) {
      await Swal.fire({
        title: 'Listo',
        text: 'Evento actualizado correctamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'swal-popup-custom',
          confirmButton: 'swal-btn-confirm',
        },
        buttonsStyling: false,
      })

      setSeccion('eventos-lista')
    } else {
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo actualizar.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'swal-popup-custom',
          confirmButton: 'swal-btn-confirm',
        },
        buttonsStyling: false,
      })
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

        {lotes.map(lote => {
          const vendidas = lote.cantidadInicial - lote.cantidad
          const tieneVentas = vendidas > 0

          return (
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

              {/* ... TODO tu JSX igual ... */}

              <input
                type="number"
                className="form-control form-control-sm"
                value={lote.cantidadInicial}
                min={vendidas}
                onChange={e => {
                  const nuevaCapacidad = Number(e.target.value) || 0
                  if (nuevaCapacidad < vendidas) return

                  const diferencia = nuevaCapacidad - lote.cantidadInicial

                  actualizarLote(lote.id, 'cantidadInicial', nuevaCapacidad)

                  // 🔑 Ajustar restantes proporcionalmente
                  actualizarLote(
                    lote.id,
                    'cantidad',
                    Math.max(lote.cantidad + diferencia, 0)
                  )
                }}
                required
              />
              <small className="text-muted">
                Vendidas: {vendidas} · Capacidad mínima permitida
              </small>
              {tieneVentas ? (
                <small className="text-danger">
                  ⚠️ Este lote tiene {vendidas} entradas vendidas. No se puede
                  modificar su capacidad.
                </small>
              ) : (
                <small className="text-muted">
                  Vendidas: 0 · Capacidad editable
                </small>
              )}
            </div>
          )
        })}

        <button className="btn btn-primary w-100" type="submit">
          Guardar cambios
        </button>
      </form>
    </div>
  )
}
