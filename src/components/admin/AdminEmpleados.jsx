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
    label: 'Nivel 4 – Acceso total',
    desc: 'Acceso total al sistema',
    badge: 'danger',
  },
}

export default function AdminEmpleados() {
  const { adminUser, user } = useAuth()

  const nivelActual = Number(adminUser?.nivel || user?.nivel || 0)

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

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Swal.fire('Error', 'Ingresa un email inválido', 'error')
      return
    }
    try {
      const existe = await getDocs(
        query(collection(db, 'empleados'), where('email', '==', email))
      )
      if (!existe.empty) {
        Swal.fire('Error', 'Email ya asignado', 'error')
        return
      }

      await addDoc(collection(db, 'empleados'), {
        nombre,
        email,
        nivel,
        password: pass,
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
