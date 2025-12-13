// --------------------------------------------------------------
// CrearEvento.jsx — Eventos + Lotes de entradas + TipTap
// --------------------------------------------------------------
import { useState, useEffect } from 'react'
import { crearEvento } from '../../services/eventosAdmin.js'
import Swal from 'sweetalert2'

// TipTap
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export default function CrearEvento() {
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

  // Descripción corta del evento
  const [descripcionHtml, setDescripcionHtml] = useState('')
  const [descripcionPlano, setDescripcionPlano] = useState('')

  // Lotes
  const [lotes, setLotes] = useState([])

  const MAX_DESC = 180

  // --------------------------------------------------------------
  // TIPTAP — descripción corta (máx 180 caracteres útiles)
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
  // HANDLERS BÁSICOS
  // --------------------------------------------------------------
  function handleInput(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // --------------------------------------------------------------
  // PREVIEW DE IMAGEN
  // --------------------------------------------------------------
  useEffect(() => {
    if (!imagen) {
      setPreviewImg(null)
      return
    }
    const url = URL.createObjectURL(imagen)
    setPreviewImg(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])

  // --------------------------------------------------------------
  // VALIDACIONES GENERALES
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

  // --------------------------------------------------------------
  // LOTES — helpers
  // --------------------------------------------------------------
  function agregarLote() {
    setLotes(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        nombre: '',
        descripcionLote: '',
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
      prev.map(l =>
        l.id === id
          ? {
              ...l,
              [campo]: campo === 'incluyeConsumicion' ? Boolean(valor) : valor,
            }
          : l
      )
    )
  }

  function eliminarLote(id) {
    setLotes(prev => prev.filter(l => l.id !== id))
  }

  function validarLotes(entradasMaximasNum) {
    if (!lotes.length) return true

    for (const lote of lotes) {
      const nombre = (lote.nombre || '').trim()
      const cantidadNum = Number(lote.cantidad) || 0

      if (!nombre) {
        Swal.fire(
          'Error en lotes',
          'Todos los lotes deben tener un nombre.',
          'error'
        )
        return false
      }

      if (cantidadNum <= 0) {
        Swal.fire(
          'Error en lotes',
          `El lote "${nombre}" debe tener una cantidad mayor a 0.`,
          'error'
        )
        return false
      }

      if (lote.desdeHora && !validarHorario(lote.desdeHora)) {
        Swal.fire(
          'Error en lotes',
          `El horario "desde" del lote "${nombre}" es inválido.`,
          'error'
        )
        return false
      }

      if (lote.hastaHora && !validarHorario(lote.hastaHora)) {
        Swal.fire(
          'Error en lotes',
          `El horario "hasta" del lote "${nombre}" es inválido.`,
          'error'
        )
        return false
      }
    }

    const totalLotes = lotes.reduce(
      (acc, l) => acc + (Number(l.cantidad) || 0),
      0
    )

    if (totalLotes > entradasMaximasNum) {
      Swal.fire(
        'Capacidad excedida',
        `La suma de todos los lotes (${totalLotes}) supera la capacidad total (${entradasMaximasNum}).`,
        'error'
      )
      return false
    }

    return true
  }

  // --------------------------------------------------------------
  // SUBMIT
  // --------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nombre || !form.fecha || !form.lugar) {
      Swal.fire('Error', 'Completá nombre, fecha y lugar del evento.', 'error')
      return
    }

    if (
      !validarHorario(form.horarioDesde) ||
      !validarHorario(form.horarioHasta)
    ) {
      Swal.fire('Error', 'Horario inválido. Formato 24hs HH:MM.', 'error')
      return
    }

    if (!validarImagen(imagen)) return

    const entradasMax = Number(form.entradasMaximas)
    if (!entradasMax || entradasMax < 10 || entradasMax > 50000) {
      Swal.fire(
        'Error',
        'La capacidad total debe estar entre 10 y 50.000.',
        'error'
      )
      return
    }

    if (!validarLotes(entradasMax)) return

    // --------------------------------------------------------------
    // DATA FINAL A GUARDAR EN FIREBASE
    // --------------------------------------------------------------
    const data = {
      nombre: form.nombre,
      fecha: form.fecha,
      lugar: form.lugar,
      horario: `Desde ${form.horarioDesde || '-'}hs hasta ${
        form.horarioHasta || '-'
      }hs.`,
      precio: Number(form.precio) || 0,
      descripcionLote: descripcionHtml, // ✔ descripción general del evento
      entradasMaximasEvento: entradasMax,
      entradasPorUsuario: Number(form.entradasPorUsuario) || 1,

      lotes: lotes.map(l => ({
        nombre: (l.nombre || '').trim(),
        descripcion: (l.descripcionLote || '').trim(), // ✔ AHORA SE GUARDA BIEN
        genero: l.genero || 'todos',
        precio: Number(l.precio) || 0,
        cantidad: Number(l.cantidad) || 0,
        desdeHora: l.desdeHora || '',
        hastaHora: l.hastaHora || '',
        incluyeConsumicion: !!l.incluyeConsumicion,
      })),
    }

    const ok = await crearEvento(data, imagen)

    if (ok) {
      Swal.fire('Listo', 'Evento creado correctamente.', 'success')

      // Reset
      setForm({
        nombre: '',
        fecha: '',
        horarioDesde: '',
        horarioHasta: '',
        lugar: '',
        precio: 0,
        entradasMaximas: '',
        entradasPorUsuario: 4,
      })
      setImagen(null)
      setPreviewImg(null)
      setDescripcionHtml('')
      setDescripcionPlano('')
      setLotes([])
      editor?.commands.setContent('')
    } else {
      Swal.fire('Error', 'No se pudo crear el evento.', 'error')
    }
  }

  // --------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------
  return (
    <section>
      <h2 className="fw-bold mb-3">Crear Evento</h2>
      <div className="container py-3">
        <form onSubmit={handleSubmit} className="border rounded p-3 shadow-sm">
          {/* ------------- CAMPOS BÁSICOS ---------------- */}
          <label className="fw-semibold">Nombre del evento*</label>
          <input
            type="text"
            name="nombre"
            className="form-control mb-3"
            placeholder="Ej: Neon Party"
            value={form.nombre}
            onChange={handleInput}
            required
          />

          <label className="fw-semibold">Fecha*</label>
          <input
            type="date"
            name="fecha"
            className="form-control mb-3"
            value={form.fecha}
            onChange={handleInput}
            required
          />

          {/* ------------------- Horarios ------------------- */}
          <label className="fw-semibold">Horarios</label>
          <div className="row g-2 mb-3">
            <div className="col">
              <input
                type="text"
                name="horarioDesde"
                value="22:00"
                className="form-control"
                value={form.horarioDesde}
                onChange={handleInput}
              />
            </div>
            <div className="col">
              <input
                type="text"
                name="horarioHasta"
                value="06:00"
                className="form-control"
                value={form.horarioHasta}
                onChange={handleInput}
              />
            </div>
          </div>

          {/* ------------------- Lugar ------------------- */}
          <label className="fw-semibold">Lugar*</label>
          <input
            type="text"
            name="lugar"
            className="form-control mb-3"
            placeholder="Dirección o nombre del local"
            value={form.lugar}
            onChange={handleInput}
            required
          />

          {/* ------------------- Precio ------------------- */}
          <label className="fw-semibold">Precio base</label>
          <input
            type="number"
            name="precio"
            className="form-control mb-3"
            placeholder="0 = Free"
            value={form.precio}
            onChange={handleInput}
          />

          {/* ------------------- Capacidad ------------------- */}
          <label className="fw-semibold">Capacidad total*</label>
          <input
            type="number"
            name="entradasMaximas"
            className="form-control mb-3"
            placeholder="Ej: 500"
            value={form.entradasMaximas}
            onChange={handleInput}
            required
          />

          {/* ------------------- Máx por usuario ------------------- */}
          <label className="fw-semibold">Máx. por usuario</label>
          <input
            type="number"
            name="entradasPorUsuario"
            className="form-control mb-3"
            value={form.entradasPorUsuario}
            onChange={handleInput}
          />

          {/* ------------------- Imagen ------------------- */}
          <label className="fw-semibold">Imagen principal</label>
          <input
            type="file"
            accept="image/*"
            className="form-control mb-3"
            onChange={e => setImagen(e.target.files[0])}
          />

          {previewImg && (
            <img
              src={previewImg}
              className="img-fluid rounded mb-3"
              style={{ maxHeight: 180, objectFit: 'cover' }}
            />
          )}

          {/* ------------------- Descripción ------------------- */}
          <label className="fw-semibold">Descripción corta</label>

          <div className="border rounded p-2 mb-1" style={{ minHeight: 150 }}>
            <EditorContent editor={editor} />
          </div>

          <small className="text-muted d-block text-end mb-3">
            {descripcionPlano.length}/{MAX_DESC}
          </small>

          {/* ------------------- LOTES ------------------- */}
          <hr className="my-3" />
          <h5 className="fw-bold">Lotes (opcional)</h5>

          <button
            type="button"
            className="btn btn-outline-dark mb-3"
            onClick={agregarLote}
          >
            ➕ Agregar lote
          </button>

          {lotes.length > 0 && (
            <div className="mb-3">
              {lotes.map(lote => (
                <div key={lote.id} className="border rounded p-2 mb-3 bg-light">
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
                    {/* Nombre del lote */}
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

                    {/* Descripción extra */}
                    <div className="col-md-4">
                      <label className="form-label small m-0">
                        Descripción (opcional)
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej: Ingreso hasta 01:30, acceso preferencial, cintas vip..."
                        value={lote.descripcionLote}
                        onChange={e =>
                          actualizarLote(
                            lote.id,
                            'descripcionLote',
                            e.target.value
                          )
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
                        placeholder="Ej: $3000"
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
                        Limite de entradas{' '}
                        <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="Ej: 50 - (Entradas disponibles para este evento)"
                        value={lote.cantidad}
                        onChange={e =>
                          actualizarLote(lote.id, 'cantidad', e.target.value)
                        }
                      />
                    </div>
                  </div>

                  {/* Género */}
                  <div className="row g-2 mb-2">
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

                    {/* Desde */}
                    <div className="col-md-2">
                      <label className="form-label small m-0">
                        Ingreso permitido{' '}
                        <span style={{ color: 'red' }}>*</span>
                      </label>

                      <div className="d-flex align-items-center gap-1">
                        {/* Desde */}
                        <span className="small"> Desde: </span>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="23:30"
                          value={lote.desdeHora}
                          onChange={e =>
                            actualizarLote(lote.id, 'desdeHora', e.target.value)
                          }
                          style={{ minWidth: '65px' }}
                          required
                        />

                        <span className="small"> Hasta: </span>

                        {/* Hasta */}
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="01:30"
                          value={lote.hastaHora}
                          onChange={e =>
                            actualizarLote(lote.id, 'hastaHora', e.target.value)
                          }
                          style={{ minWidth: '65px' }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consumición */}
                  <div className="row g-2 mb-2">
                    <div className="col-md-12 d-flex align-items-center">
                      <input
                        type="checkbox"
                        className="form-check-input me-2"
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
              ))}
            </div>
          )}

          {/* SUBMIT */}
          <button className="btn btn-primary w-100 mt-5" type="submit">
            Crear evento
          </button>
        </form>
      </div>
    </section>
  )
}
