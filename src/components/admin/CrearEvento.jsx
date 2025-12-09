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

  const [descripcionHtml, setDescripcionHtml] = useState('')
  const [descripcionPlano, setDescripcionPlano] = useState('')

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
        // Guardamos texto plano truncado como HTML simple
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
        genero: 'todos', // todos | hombres | mujeres
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

    // Validar campos mínimos en cada lote
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
          `El horario "desde" del lote "${nombre}" es inválido. Formato HH:MM.`,
          'error'
        )
        return false
      }

      if (lote.hastaHora && !validarHorario(lote.hastaHora)) {
        Swal.fire(
          'Error en lotes',
          `El horario "hasta" del lote "${nombre}" es inválido. Formato HH:MM.`,
          'error'
        )
        return false
      }
    }

    // Validar capacidad total
    const totalLotes = lotes.reduce(
      (acc, l) => acc + (Number(l.cantidad) || 0),
      0
    )

    if (totalLotes > entradasMaximasNum) {
      Swal.fire(
        'Capacidad excedida',
        `La suma de cantidades de todos los lotes (${totalLotes}) supera la capacidad total del evento (${entradasMaximasNum}).`,
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

    // Campos obligatorios base
    if (!form.nombre || !form.fecha || !form.lugar) {
      Swal.fire('Error', 'Completá nombre, fecha y lugar del evento.', 'error')
      return
    }

    if (
      !validarHorario(form.horarioDesde) ||
      !validarHorario(form.horarioHasta)
    ) {
      Swal.fire('Error', 'Horario inválido. Usá formato 24hs: HH:MM.', 'error')
      return
    }

    if (!validarImagen(imagen)) return

    const entradasMax = Number(form.entradasMaximas)
    if (!entradasMax || entradasMax < 10 || entradasMax > 50000) {
      Swal.fire(
        'Error',
        'La capacidad total debe estar entre 10 y 50.000 personas.',
        'error'
      )
      return
    }

    // Validar lotes
    if (!validarLotes(entradasMax)) return

    const data = {
      nombre: form.nombre,
      fecha: form.fecha,
      lugar: form.lugar,
      horario: `Desde ${form.horarioDesde || '-'}hs hasta ${
        form.horarioHasta || '-'
      }hs.`,
      precio: Number(form.precio) || 0,
      descripcion: descripcionHtml,
      entradasMaximasEvento: entradasMax,
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
    <div className="container py-3">
      <h2 className="fw-bold mb-3">Crear Evento</h2>

      <form onSubmit={handleSubmit} className="border rounded p-3 shadow-sm">
        {/* ------------------- Nombre ------------------- */}
        <label className="fw-semibold">Nombre del evento*</label>
        <small className="text-muted d-block mb-1">
          Ejemplo: "Neon Party", "Fiesta Halloween", "Cerveza & Friends".
        </small>
        <input
          type="text"
          name="nombre"
          className="form-control mb-3"
          placeholder="Ej: Fiesta de Apertura"
          value={form.nombre}
          onChange={handleInput}
          required
        />

        {/* ------------------- Fecha ------------------- */}
        <label className="fw-semibold">Fecha del evento*</label>
        <small className="text-muted d-block mb-1">
          Seleccioná la fecha en el calendario.
        </small>
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
        <small className="text-muted d-block mb-2">
          Formato 24hs — Ejemplo: 22:00 / 06:00. Se verá en la ficha del evento.
        </small>

        <div className="row g-2 mb-3">
          <div className="col">
            <input
              type="text"
              name="horarioDesde"
              className="form-control"
              placeholder="22:00"
              value={form.horarioDesde}
              onChange={handleInput}
            />
          </div>

          <div className="col">
            <input
              type="text"
              name="horarioHasta"
              className="form-control"
              placeholder="06:00"
              value={form.horarioHasta}
              onChange={handleInput}
            />
          </div>
        </div>

        {/* ------------------- Lugar ------------------- */}
        <label className="fw-semibold">Lugar*</label>
        <small className="text-muted d-block mb-1">
          Dirección o nombre del boliche/bar/salón. Ej: "Bar X - Av. Siempre
          Viva 123".
        </small>
        <input
          type="text"
          name="lugar"
          className="form-control mb-3"
          placeholder="Ej: Av. Gral. San Martín 1820"
          value={form.lugar}
          onChange={handleInput}
          required
        />

        {/* ------------------- Precio base ------------------- */}
        <label className="fw-semibold">Precio base (opcional)</label>
        <small className="text-muted d-block mb-1">
          Solo se usará si no manejás lotes diferenciados. Podés dejarlo en 0.
        </small>
        <input
          type="number"
          name="precio"
          className="form-control mb-3"
          placeholder="Ej: 6000"
          value={form.precio}
          onChange={handleInput}
        />

        {/* ------------------- Entradas máximas ------------------- */}
        <label className="fw-semibold">Capacidad total del evento*</label>
        <small className="text-muted d-block mb-1">
          Cantidad total de personas que pueden asistir (sumando todos los
          lotes).
        </small>
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
        <label className="fw-semibold">Entradas máximas por usuario</label>
        <small className="text-muted d-block mb-1">
          Límite de tickets que puede comprar una misma persona (Ej: 4).
        </small>
        <input
          type="number"
          name="entradasPorUsuario"
          className="form-control mb-3"
          placeholder="Máx. por usuario (Ej: 4)"
          value={form.entradasPorUsuario}
          onChange={handleInput}
        />

        {/* ------------------- IMAGEN + PREVIEW ------------------- */}
        <label className="fw-semibold">Imagen principal del evento</label>
        <small className="text-muted d-block mb-2">
          Recomendado 1200×675px. Formatos: JPG, PNG, WEBP. Se mostrará en la
          tarjeta del evento.
        </small>
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
            alt="Preview evento"
          />
        )}

        {/* ------------------- DESCRIPCIÓN ------------------- */}
        <label className="fw-semibold">Descripción corta del evento</label>
        <small className="text-muted d-block mb-2">
          Máximo {MAX_DESC} caracteres. Se muestra en la tarjeta del evento.
          Podés usar negrita/listas, pero el texto se truncará si es muy largo.
        </small>

        <div className="border rounded p-2 mb-1" style={{ minHeight: 150 }}>
          <EditorContent editor={editor} />
        </div>

        <small className="text-muted d-block text-end mb-3">
          {descripcionPlano.length}/{MAX_DESC}
        </small>

        {/* ======================================================
           LOTES DE ENTRADAS
           ====================================================== */}

        {/* ======================================================
     LOTES DE ENTRADAS
====================================================== */}

        <hr className="my-3" />
        <h5 className="fw-bold">Lotes de entradas (opcional)</h5>
        <small className="text-muted d-block mb-2">
          Ideal para manejar free, consumición, distintos precios u horarios.
        </small>

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
                {/* TITULO + ELIMINAR */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>{lote.nombre || 'Lote sin nombre'}</strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => eliminarLote(lote.id)}
                  >
                    Eliminar
                  </button>
                </div>

                {/* ============================
             FILA 1 — PRINCIPAL
        ============================ */}
                <div className="row g-2 mb-2 align-items-end">
                  {/* Nombre */}
                  <div className="col-md-4">
                    <label className="form-label small m-0">Nombre</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej: Free Mujeres"
                      value={lote.nombre}
                      onChange={e =>
                        actualizarLote(lote.id, 'nombre', e.target.value)
                      }
                    />
                  </div>

                  {/* Género */}
                  <div className="col-md-3">
                    <label className="form-label small m-0">Género</label>
                    <select
                      className="form-select form-select-sm"
                      value={lote.genero}
                      onChange={e =>
                        actualizarLote(lote.id, 'genero', e.target.value)
                      }
                    >
                      <option value="todos">Todos</option>
                      <option value="hombres">Hombres</option>
                      <option value="mujeres">Mujeres</option>
                    </select>
                  </div>

                  {/* Precio */}
                  <div className="col-md-3">
                    <label className="form-label small m-0">Precio</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      placeholder="0 = Free"
                      value={lote.precio}
                      onChange={e =>
                        actualizarLote(lote.id, 'precio', e.target.value)
                      }
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="col-md-2">
                    <label className="form-label small m-0">Cantidad</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      placeholder="Ej: 100"
                      value={lote.cantidad}
                      onChange={e =>
                        actualizarLote(lote.id, 'cantidad', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* ============================
             FILA 2 — HORARIOS + CONSUMICIÓN
        ============================ */}
                <div className="row g-2 mb-2 align-items-end">
                  {/* Desde */}
                  <div className="col-6 col-md-3">
                    <label className="form-label small m-0">Desde</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="23:30"
                      value={lote.desdeHora}
                      onChange={e =>
                        actualizarLote(lote.id, 'desdeHora', e.target.value)
                      }
                    />
                  </div>

                  {/* Hasta */}
                  <div className="col-6 col-md-3">
                    <label className="form-label small m-0">Hasta</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="01:30"
                      value={lote.hastaHora}
                      onChange={e =>
                        actualizarLote(lote.id, 'hastaHora', e.target.value)
                      }
                    />
                  </div>

                  {/* Consumición */}
                  <div className="col-12 col-md-6 d-flex align-items-end">
                    <div className="form-check ms-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`consumicion-${lote.id}`}
                        checked={lote.incluyeConsumicion}
                        onChange={e =>
                          actualizarLote(
                            lote.id,
                            'incluyeConsumicion',
                            e.target.checked
                          )
                        }
                      />
                      <label
                        className="form-check-label small"
                        htmlFor={`consumicion-${lote.id}`}
                      >
                        Incluye consumición
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ------------------- BOTÓN FINAL ------------------- */}
        <button className="btn btn-primary w-100" type="submit">
          Crear evento
        </button>
      </form>
    </div>
  )
}
