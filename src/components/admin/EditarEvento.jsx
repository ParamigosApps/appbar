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
  // HELPER — convertir HH:MM a minutos
  // --------------------------------------------------------------
  function horaAMinutos(hora) {
    if (!hora || typeof hora !== 'string') return null
    const [h, m] = hora.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return h * 60 + m
  }
  function esEventoNocturno() {
    const ini = horaAMinutos(form.horaInicio)
    const fin = horaAMinutos(form.horaFin)
    if (ini === null || fin === null) return false
    return fin < ini
  }

  function normalizarRangoNocturno(desdeMin, hastaMin) {
    if (desdeMin === null || hastaMin === null) return null

    // Si cruza medianoche (23:00 → 01:30)
    if (hastaMin < desdeMin) {
      return {
        desde: desdeMin,
        hasta: hastaMin + 24 * 60,
      }
    }

    return {
      desde: desdeMin,
      hasta: hastaMin,
    }
  }

  function validarHorasLotesVsInicioEvento() {
    const inicioEventoMin = horaAMinutos(form.horaInicio)
    const finEventoMin = horaAMinutos(form.horaFin)

    if (inicioEventoMin === null || finEventoMin === null) return true

    // Evento nocturno
    const finEventoReal =
      finEventoMin < inicioEventoMin ? finEventoMin + 24 * 60 : finEventoMin

    for (const l of lotes) {
      const desdeMin = horaAMinutos(l.desdeHora)
      const hastaMin = horaAMinutos(l.hastaHora)

      if (desdeMin === null || hastaMin === null) continue

      const rango = normalizarRangoNocturno(desdeMin, hastaMin)
      if (!rango) continue

      // ❌ NO puede empezar antes del inicio del evento
      if (rango.desde < inicioEventoMin) {
        Swal.fire(
          'Horario inválido',
          `El lote "${
            l.nombre || 'Sin nombre'
          }" comienza antes del inicio del evento (${form.horaInicio}).`,
          'error'
        )
        return false
      }

      // ❌ NO puede terminar después del fin del evento
      if (rango.hasta > finEventoReal) {
        const finEventoTexto =
          finEventoMin < inicioEventoMin
            ? `${form.horaFin} (día siguiente)`
            : form.horaFin

        Swal.fire(
          'Horario inválido',
          `El lote "${
            l.nombre || 'Sin nombre'
          }" finaliza después del horario permitido del evento.\n\n` +
            `⏰ Fin del evento: ${finEventoTexto}\n` +
            `⛔ Fin del lote: ${l.hastaHora}`,
          'error'
        )
        return false
      }
    }

    return true
  }

  // --------------------------------------------------------------
  // TIPTAP
  // --------------------------------------------------------------
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate({ editor }) {
      setDescripcionPlano(editor.getText() || '')
      setDescripcionHtml(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    if (descripcionHtml) return // evita pisar lo que escribe el usuario

    editor.commands.setContent(descripcionHtml || '')
  }, [editor])

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
              const cantidad = Number(l.cantidad ?? cantidadInicial)

              // vendidas = cantidadInicial - cantidad (restantes)
              // Guardamos original para poder validar contra vendidas reales
              return {
                id: idx + '-' + Date.now(),
                ...l,

                cantidadInicial,
                cantidad,

                _originalCantidadInicial: cantidadInicial,
                _originalCantidad: cantidad,

                isNew: false, // 🔒 lote existente
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
  // VALIDACIONES (TUS FUNCIONES, SIN QUITAR)
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
        cantidadInicial: 0,
        cantidad: 0,
        desdeHora: '',
        hastaHora: '',
        incluyeConsumicion: false,
        maxPorUsuario: 0,
        _originalCantidadInicial: 0,
        _originalCantidad: 0,
        isNew: true,
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

  // ✅ CORREGIDA: vendidas reales y validación correcta
  function validarLotesEditados() {
    for (const l of lotes) {
      const oi = Number(l._originalCantidadInicial ?? 0)
      const oc = Number(l._originalCantidad ?? 0)

      // Si en tu modelo "cantidad" = restantes:
      // vendidas = originalInicial - originalRestantes
      const vendidas = Math.max(oi - oc, 0)

      const nuevaCapacidad = Number(l.cantidadInicial ?? 0)
      if (nuevaCapacidad < vendidas) {
        Swal.fire(
          'Error',
          `El lote "${
            l.nombre || 'Sin nombre'
          }" no puede tener menos capacidad que entradas ya vendidas (${vendidas}).`,
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
      Swal.fire(
        'Error',
        'Completá fechas, horarios y lugar del evento.',
        'error'
      )
      return
    }

    if (descripcionPlano.length > MAX_DESC) {
      Swal.fire(
        'Descripción demasiado larga',
        `La descripción del evento no puede superar los ${MAX_DESC} caracteres.`,
        'error'
      )
      return
    }

    // 1️⃣ Formato horario evento
    if (!validarHorario(form.horaInicio) || !validarHorario(form.horaFin)) {
      Swal.fire('Error', 'Horario inválido. Formato HH:MM.', 'error')
      return
    }

    // 2️⃣ Horas de lotes vs inicio del evento
    if (!validarHorasLotesVsInicioEvento()) return

    // 3️⃣ Capacidades vs vendidas
    if (!validarLotesEditados()) return

    // 4️⃣ Imagen
    if (!validarImagen(imagen)) return

    // 5️⃣ Capacidad total
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

        // Guardamos ambos
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
          placeholder="Ej: Neon Party"
          value={form.nombre}
          onChange={handleInput}
        />

        {/* ------------------- Horarios ------------------- */}
        <label className="fw-semibold">Inicio del evento*</label>
        <input
          type="date"
          name="fechaInicio"
          className="form-control"
          value={form.fechaInicio}
          onChange={handleInput}
        />
        <p className="text-muted small mt-1">
          <span className="text-danger">¡Atención!</span> En eventos nocturnos.
          Por ej: (23:00hs → 06:00hs) deben finalizar en la{' '}
          <strong>fecha del día siguiente</strong>.
        </p>

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
          className="form-control"
          value={form.horaFin}
          onChange={handleInput}
        />
        <p className="text-muted small mt-1">
          <span className="text-danger">Atención:</span> Si el evento es
          nocturno, la <strong>fecha de fin</strong> debe ser el
          <strong> día siguiente</strong>.
        </p>

        {/* ------------------- Lugar ------------------- */}
        <label className="fw-semibold">Lugar*</label>
        <input
          type="text"
          name="lugar"
          className="form-control mb-3"
          placeholder="Dirección o nombre del local"
          value={form.lugar}
          onChange={handleInput}
        />

        {/* ------------------- Precio base ------------------- */}
        <label className="fw-semibold">Precio base</label>
        <input
          type="number"
          name="precio"
          className="form-control"
          value={form.precio}
          onChange={handleInput}
        />
        <p className="text-muted small mt-1">
          <span className="text-danger">¡Atención!</span> Utilizá el valor $0
          para indicar evento gratuito.{' '}
          <strong>Solo se aplica cuando no existen lotes configurados.</strong>
        </p>

        {/* ------------------- Capacidad ------------------- */}
        <label className="fw-semibold">Capacidad total*</label>
        <input
          type="number"
          name="entradasMaximas"
          className="form-control"
          value={form.entradasMaximas}
          onChange={handleInput}
        />
        <p className="text-muted small mt-1">
          <span className="text-danger">¡Atención!</span> El total de los lotes
          no podrá exceder este número.
        </p>

        {/* ------------------- Máximo por usuario ------------------- */}
        <label className="fw-semibold">Máx. por usuario</label>
        <input
          type="number"
          name="entradasPorUsuario"
          className="form-control"
          value={form.entradasPorUsuario}
          onChange={handleInput}
        />
        <p className="text-muted small mt-1">
          Número de entradas que puede solicitar un Usuario.{' '}
          <strong>Solo se aplica cuando no existen lotes configurados.</strong>
        </p>

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

        <small className="text-muted d-block text-end mb-3">
          {descripcionPlano.length}/{MAX_DESC}
        </small>

        {/* ------------------- LOTES ------------------- */}
        <hr />
        <h5 className="fw-bold">Lotes (opcional)</h5>

        <button
          type="button"
          className="btn btn-outline-dark mb-3"
          onClick={agregarLote}
        >
          Agregar lote
        </button>

        {lotes.map(lote => {
          const esLoteNuevo = lote.isNew === true

          // vendidas reales según original (modelo "cantidad"=restantes)
          const oi = Number(lote._originalCantidadInicial ?? 0)
          const oc = Number(lote._originalCantidad ?? 0)
          const vendidas = Math.max(oi - oc, 0)
          const minPermitido = vendidas

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
              {/* ------------------- NOMBRE DEL LOTE ------------------- */}
              <label className="form-label m-0 mt-2">Nombre del lote</label>

              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Ej: General, VIP, Anticipada"
                value={lote.nombre || ''}
                disabled={!esLoteNuevo}
                onChange={e =>
                  actualizarLote(lote.id, 'nombre', e.target.value)
                }
              />

              {!esLoteNuevo && (
                <small className="text-muted d-block mt-1">
                  🔒 El nombre no puede modificarse porque el lote ya fue
                  creado.
                </small>
              )}

              <label className="form-label m-0 mt-2">
                Descripción del lote
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={lote.descripcion || ''}
                placeholder="Ej: Acceso preferencial, incluye cinta VIP, etc.."
                maxLength={80}
                onChange={e =>
                  actualizarLote(lote.id, 'descripcion', e.target.value)
                }
              />
              <p className="text-muted small mt-1 mb-0">
                <span className="text-danger">¡Atención!</span> Obviar
                información: <strong>Valor, Horario, Costo.</strong>
              </p>

              <small className="text-muted d-block text-end">
                Limite de caracteres: {(lote.descripcion || '').length}/80
              </small>

              {/* EJEMPLO: si tenés inputs de horario, limitarlos por horaInicio */}
              <div className="row g-2 mb-2">
                <div className="row g-2 mb-2">
                  <label className="form-label m-0 mt-2">
                    Ingreso permitido del lote
                  </label>
                  <div className="col-4">
                    <label className="form-label m-0">A partir de:</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={lote.desdeHora}
                      min={form.horaInicio || undefined}
                      max={form.horaFin || undefined}
                      onChange={e =>
                        actualizarLote(lote.id, 'desdeHora', e.target.value)
                      }
                      style={{ maxWidth: 90 }}
                      required
                    />
                  </div>

                  <div className="col-4">
                    <label className="form-label m-0">Hasta las:</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={lote.hastaHora}
                      min={lote.desdeHora || form.horaInicio || undefined}
                      max={form.horaFin || undefined}
                      onChange={e =>
                        actualizarLote(lote.id, 'hastaHora', e.target.value)
                      }
                      style={{ maxWidth: 90 }}
                      required
                    />
                  </div>
                  <p className="text-muted small mt-1 mb-0">
                    <span className="text-danger">¡Atención! </span>Si el
                    usuario intenta escanear entradas de este lote fuera de el
                    horario establecido{' '}
                    <strong>Son rechazadas por el sistema QR.</strong>
                  </p>
                </div>
              </div>

              {/* CAPACIDAD DEL LOTE: editable, pero con mínimo vendidas */}
              <label className="form-label m-0">Capacidad del lote</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={Number(lote.cantidadInicial) || 0}
                min={minPermitido}
                onChange={e => {
                  const nuevaCapacidad = Number(e.target.value) || 0
                  if (nuevaCapacidad < minPermitido) return

                  const anteriorCap = Number(lote.cantidadInicial) || 0
                  const anteriorRestantes = Number(lote.cantidad) || 0

                  // diferencia de capacidad total
                  const diferencia = nuevaCapacidad - anteriorCap

                  // Ajustar "restantes" manteniendo vendidas constantes
                  // restantes = capacidad - vendidas
                  const nuevosRestantes = Math.max(nuevaCapacidad - vendidas, 0)

                  actualizarLote(lote.id, 'cantidadInicial', nuevaCapacidad)
                  actualizarLote(lote.id, 'cantidad', nuevosRestantes)
                }}
                required
              />

              {!esLoteNuevo && (
                <>
                  <small className="text-muted d-block">
                    Vendidas: {vendidas} · Mínimo permitido: {minPermitido}
                  </small>

                  <small className="text-muted d-block">
                    Restantes calculadas:{' '}
                    {Math.max(
                      (Number(lote.cantidadInicial) || 0) - vendidas,
                      0
                    )}
                  </small>
                </>
              )}

              {/* ------------------- MÁX. POR USUARIO ------------------- */}
              <label className="form-label m-0 mt-2">Máx. por usuario</label>

              <input
                type="number"
                className="form-control form-control-sm"
                min={0}
                value={Number(lote?.maxPorUsuario) || 2}
                disabled={!esLoteNuevo}
                onChange={e =>
                  actualizarLote(
                    lote.id,
                    'maxPorUsuario',
                    Number(e.target.value) || 0
                  )
                }
              />
              {!esLoteNuevo && (
                <small className="text-muted d-block mt-1">
                  🔒 No se puede modificar el máximo por usuario porque el lote
                  ya fue creado.
                </small>
              )}
              {esLoteNuevo && (
                <p className="text-muted small mt-1 mb-0">
                  Recomendación: Máximo 2 entradas por usuario para lotes FREE y
                  8 entradas para lotes pagos.
                </p>
              )}
            </div>
          )
        })}

        <button
          className="btn swal-btn-confirm d-block mx-auto mb-3"
          type="submit"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  )
}
