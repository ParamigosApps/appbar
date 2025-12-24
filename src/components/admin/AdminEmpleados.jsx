// --------------------------------------------------------------
// AdminEmpleados.jsx — CRUD de Empleados + Permisos (versión PRO)
// --------------------------------------------------------------

/*
import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore'

import { auth, db } from '../../Firebase'
import Swal from 'sweetalert2'

export default function AdminEmpleados() {
  const [empleados, setEmpleados] = useState([])

  const [modo, setModo] = useState('crear')
  const [editId, setEditId] = useState(null)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [nivel, setNivel] = useState('')

  // Campos faltantes para borde rojo
  const [errores, setErrores] = useState({
    nombre: false,
    email: false,
    pass: false,
    nivel: false,
  })

  // ================================
  // Cargar empleados en tiempo real
  // ================================
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'empleados'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEmpleados(lista)
    })
    return unsub
  }, [])

  // ================================
  // VALIDAR EMAIL (sin espacios)
  // ================================
  function validarEmailSinEspacios(emailStr) {
    if (emailStr.includes(' ')) {
      Swal.fire('Error', 'El email no puede contener espacios.', 'error')
      return false
    }
    return true
  }

  // ================================
  // Validar campos vacíos
  // ================================
  function validarCamposCrear() {
    const nuevosErrores = {
      nombre: nombre.trim() === '',
      email: email.trim() === '',
      pass: pass.trim() === '',
      nivel: nivel.trim() === '',
    }

    setErrores(nuevosErrores)

    return !Object.values(nuevosErrores).includes(true)
  }

  function validarCamposEditar() {
    const nuevosErrores = {
      nombre: nombre.trim() === '',
      email: email.trim() === '',
      pass: false,
      nivel: nivel.trim() === '',
    }

    setErrores(nuevosErrores)

    return !Object.values(nuevosErrores).includes(true)
  }

  // ================================
  // Crear empleado
  // ================================
  async function crearEmpleado(e) {
    e.preventDefault()

    if (!validarCamposCrear()) {
      Swal.fire('Error', 'Completá todos los campos.', 'error')
      return
    }

    if (!validarEmailSinEspacios(email)) return

    try {
      // Verificar si ya existe un empleado con ese email
      const q = query(collection(db, 'empleados'), where('email', '==', email))
      const snap = await getDocs(q)
      if (!snap.empty) {
        Swal.fire('Error', 'Ese email ya está asignado a un empleado.', 'error')
        return
      }

      // Crear cuenta Auth
      const cred = await createUserWithEmailAndPassword(auth, email, pass)

      // Crear documento Firestore
      await addDoc(collection(db, 'empleados'), {
        uid: cred.user.uid,
        nombre,
        email,
        nivel,
        password: pass, // ← NECESARIO PARA LOGIN MANUAL
      })

      Swal.fire('Listo', 'Empleado creado correctamente', 'success')
      limpiar()
    } catch (error) {
      console.error('Error creando empleado:', error)

      if (error.code === 'auth/email-already-in-use') {
        Swal.fire(
          'Correo en uso',
          'Ese email ya pertenece a una cuenta existente.',
          'error'
        )
        return
      }

      if (error.code === 'auth/weak-password') {
        Swal.fire(
          'Contraseña débil',
          'La contraseña debe tener al menos 6 caracteres.',
          'error'
        )
        return
      }

      Swal.fire('Error', 'No se pudo crear al empleado', 'error')
    }
  }

  // ================================
  // Cargar datos para editar
  // ================================
  function cargarEditar(emp) {
    setModo('editar')
    setEditId(emp.id)
    setNombre(emp.nombre)
    setEmail(emp.email)
    setNivel(emp.nivel)
    setPass('')
    setErrores({ nombre: false, email: false, pass: false, nivel: false })
  }

  // ================================
  // Guardar edición
  // ================================
  async function guardarEdicion(e) {
    e.preventDefault()

    if (!validarCamposEditar()) {
      Swal.fire('Error', 'Completá todos los campos.', 'error')
      return
    }

    if (!validarEmailSinEspacios(email)) return

    const ref = doc(db, 'empleados', editId)

    await updateDoc(ref, {
      nombre,
      email,
      nivel,
    })

    Swal.fire('Actualizado', 'Empleado editado', 'success')
    limpiar()
  }

  // ================================
  // Borrar empleado
  // ================================
  async function borrarEmpleado(id, uid) {
    if (!confirm('¿Eliminar empleado?')) return

    try {
      await deleteDoc(doc(db, 'empleados', id))

      if (auth.currentUser?.uid === uid) {
        await deleteUser(auth.currentUser)
      }

      Swal.fire('Eliminado', 'Empleado borrado correctamente', 'success')
    } catch (error) {
      console.error('Error borrando empleado:', error)
      Swal.fire('Error', 'No se pudo borrar al empleado', 'error')
    }
  }

  // ================================
  // Limpiar formulario
  // ================================
  function limpiar() {
    setModo('crear')
    setEditId(null)
    setNombre('')
    setEmail('')
    setPass('')
    setNivel('')
    setErrores({ nombre: false, email: false, pass: false, nivel: false })
  }

  // ================================
  // UI
  // ================================
  return (
    <div>
      <h2 className="fw-bold mb-3">
        {modo === 'crear' ? 'Crear Empleado' : 'Editar Empleado'}
      </h2>

      <form
        onSubmit={modo === 'crear' ? crearEmpleado : guardarEdicion}
        className="border p-3 rounded shadow-sm mb-4"
      >
        <div className="row g-3">
          
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">Nombre</label>
            <input
              type="text"
              className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
            {errores.nombre && (
              <div className="invalid-feedback">Campo obligatorio</div>
            )}
          </div>

        
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">Email (login)</label>
            <input
              type="email"
              className={`form-control ${errores.email ? 'is-invalid' : ''}`}
              value={email}
              onChange={e => setEmail(e.target.value.trim())}
              disabled={modo === 'editar'}
            />
            {errores.email && (
              <div className="invalid-feedback">Campo obligatorio</div>
            )}
          </div>

          
         
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Contraseña</label>
              <input
                type="password"
                className={`form-control ${errores.pass ? 'is-invalid' : ''}`}
                value={pass}
                onChange={e => setPass(e.target.value)}
              />
              {errores.pass && (
                <div className="invalid-feedback">Campo obligatorio</div>
              )}
            </div>
          )}

        
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">
              Permiso del empleado
            </label>
            <select
              className={`form-select ${errores.nivel ? 'is-invalid' : ''}`}
              value={nivel}
              onChange={e => setNivel(e.target.value)}
            >
              <option value="">Seleccionar nivel</option>
              <option value="1">Nivel 1 – Entradas</option>
              <option value="2">Nivel 2 – Compras</option>
              <option value="3">Nivel 3 – Entradas + Compras</option>
              <option value="4">Nivel 4 – Acceso total</option>
            </select>
            {errores.nivel && (
              <div className="invalid-feedback">Campo obligatorio</div>
            )}
          </div>
        </div>
    
        <div className="form-divider my-4" />
        <div className="mt-1  d-flex justify-content-center">
          <button className="btn swal-btn-confirm mt-3">
            {modo === 'crear' ? 'Crear cuenta' : 'Guardar cambios'}
          </button>
        </div>

        {modo === 'editar' && (
          <button
            type="button"
            className="btn btn-secondary ms-2 mt-3"
            onClick={limpiar}
          >
            Cancelar
          </button>
        )}
      </form>

 
      <h3 className="fw-bold mb-3">Empleados creados</h3>

      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Nivel</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {empleados.map(emp => (
              <tr key={emp.id}>
                <td>{emp.nombre}</td>
                <td>{emp.email}</td>
                <td>{emp.nivel}</td>

                <td className="text-end">
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => cargarEditar(emp)}
                  >
                    Editar
                  </button>

                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => borrarEmpleado(emp.id, emp.uid)}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
*/

// --------------------------------------------------------------
// AdminEmpleados.jsx — CRUD Empleados + Permisos (FINAL PRO 2025)
// --------------------------------------------------------------
import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore'

import { auth, db } from '../../Firebase'
import { useAuth } from '../../context/AuthContext'
import Swal from 'sweetalert2'

// --------------------------------------------------------------
// 🔐 MAPA DE ROLES
// --------------------------------------------------------------
const ROLES = {
  1: {
    label: 'Nivel 1 – Puerta',
    desc: 'Validar entradas únicamente',
    badge: 'secondary',
  },
  2: {
    label: 'Nivel 2 – Caja',
    desc: 'Cobrar y entregar pedidos',
    badge: 'info',
  },
  3: {
    label: 'Nivel 3 – Encargado',
    desc: 'Entradas + Compras + Cancelaciones',
    badge: 'warning',
  },
  4: {
    label: 'Nivel 4 – Dueño',
    desc: 'Acceso total al sistema',
    badge: 'danger',
  },
}

export default function AdminEmpleados() {
  const { empleado } = useAuth() // 👈 empleado logueado
  const nivelActual = Number(empleado?.nivel || 0)

  const [empleados, setEmpleados] = useState([])

  const [modo, setModo] = useState('crear')
  const [editId, setEditId] = useState(null)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [nivel, setNivel] = useState('')

  const [errores, setErrores] = useState({
    nombre: false,
    email: false,
    pass: false,
    nivel: false,
  })

  // --------------------------------------------------------------
  // 🔒 PROTECCIÓN: SOLO NIVEL 4
  // --------------------------------------------------------------
  if (nivelActual !== 4) {
    return (
      <div className="alert alert-danger">
        ⛔ Solo el dueño puede administrar empleados.
      </div>
    )
  }

  // --------------------------------------------------------------
  // LISTENER
  // --------------------------------------------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'empleados'), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setEmpleados(lista)
    })
    return unsub
  }, [])

  // --------------------------------------------------------------
  // VALIDACIONES
  // --------------------------------------------------------------
  function validarCampos(crear = true) {
    const e = {
      nombre: nombre.trim() === '',
      email: email.trim() === '',
      pass: crear && pass.trim() === '',
      nivel: nivel.trim() === '',
    }
    setErrores(e)
    return !Object.values(e).includes(true)
  }

  // --------------------------------------------------------------
  // CREAR
  // --------------------------------------------------------------
  async function crearEmpleado(e) {
    e.preventDefault()
    if (!validarCampos(true)) return

    try {
      const existe = await getDocs(
        query(collection(db, 'empleados'), where('email', '==', email))
      )
      if (!existe.empty) {
        Swal.fire('Error', 'Email ya asignado', 'error')
        return
      }

      const cred = await createUserWithEmailAndPassword(auth, email, pass)

      await addDoc(collection(db, 'empleados'), {
        uid: cred.user.uid,
        nombre,
        email,
        nivel,
        password: pass, // login manual
        creadoEn: new Date(),
      })

      Swal.fire('Listo', 'Empleado creado', 'success')
      limpiar()
    } catch (err) {
      console.error(err)
      Swal.fire('Error', err.message, 'error')
    }
  }

  // --------------------------------------------------------------
  // EDITAR
  // --------------------------------------------------------------
  function cargarEditar(emp) {
    setModo('editar')
    setEditId(emp.id)
    setNombre(emp.nombre)
    setEmail(emp.email)
    setNivel(emp.nivel)
    setPass('')
    setErrores({})
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    if (!validarCampos(false)) return

    await updateDoc(doc(db, 'empleados', editId), {
      nombre,
      nivel,
    })

    Swal.fire('Actualizado', 'Empleado editado', 'success')
    limpiar()
  }

  // --------------------------------------------------------------
  // BORRAR (protección último admin)
  // --------------------------------------------------------------
  async function borrarEmpleado(emp) {
    const admins = empleados.filter(e => Number(e.nivel) === 4)

    if (Number(emp.nivel) === 4 && admins.length <= 1) {
      Swal.fire(
        'Bloqueado',
        'Debe existir al menos un dueño en el sistema',
        'warning'
      )
      return
    }

    const ok = await Swal.fire({
      title: 'Eliminar empleado',
      text: `¿Eliminar a ${emp.nombre}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    })

    if (!ok.isConfirmed) return

    await deleteDoc(doc(db, 'empleados', emp.id))
    Swal.fire('Eliminado', 'Empleado borrado', 'success')
  }

  function limpiar() {
    setModo('crear')
    setEditId(null)
    setNombre('')
    setEmail('')
    setPass('')
    setNivel('')
    setErrores({})
  }

  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div>
      <h3 className="fw-bold mb-3">Administración de empleados</h3>

      {/* FORM */}
      <form
        onSubmit={modo === 'crear' ? crearEmpleado : guardarEdicion}
        className="card p-3 mb-4"
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label>Nombre</label>
            <input
              className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
          </div>

          <div className="col-md-6">
            <label>Email</label>
            <input
              className={`form-control ${errores.email ? 'is-invalid' : ''}`}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={modo === 'editar'}
            />
          </div>

          {modo === 'crear' && (
            <div className="col-md-6">
              <label>Contraseña</label>
              <input
                type="password"
                className={`form-control ${errores.pass ? 'is-invalid' : ''}`}
                value={pass}
                onChange={e => setPass(e.target.value)}
              />
            </div>
          )}

          <div className="col-md-6">
            <label>Permiso</label>
            <select
              className={`form-select ${errores.nivel ? 'is-invalid' : ''}`}
              value={nivel}
              onChange={e => setNivel(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
            {nivel && (
              <small className="text-muted">{ROLES[nivel]?.desc}</small>
            )}
          </div>
        </div>

        <div className="mt-3 text-center">
          <button className="btn swal-btn-confirm">
            {modo === 'crear' ? 'Crear empleado' : 'Guardar cambios'}
          </button>
          {modo === 'editar' && (
            <button
              type="button"
              className="btn btn-secondary ms-2"
              onClick={limpiar}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* LISTADO */}
      <table className="table table-bordered align-middle">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {empleados.map(emp => (
            <tr key={emp.id}>
              <td>{emp.nombre}</td>
              <td>{emp.email}</td>
              <td>
                <span className={`badge bg-${ROLES[emp.nivel]?.badge}`}>
                  {ROLES[emp.nivel]?.label}
                </span>
              </td>
              <td className="text-end">
                <button
                  className="btn btn-sm btn-primary me-2"
                  onClick={() => cargarEditar(emp)}
                >
                  Editar
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => borrarEmpleado(emp)}
                >
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
