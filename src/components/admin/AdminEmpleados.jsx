// --------------------------------------------------------------
// AdminEmpleados.jsx — CRUD de Empleados + Permisos
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
  // Crear empleado
  // ================================
  async function crearEmpleado(e) {
    e.preventDefault()

    try {
      // Crear cuenta Auth
      const cred = await createUserWithEmailAndPassword(auth, email, pass)

      // Crear documento Firestore
      await addDoc(collection(db, 'empleados'), {
        uid: cred.user.uid,
        nombre,
        email,
        nivel,
      })

      Swal.fire('Listo', 'Empleado creado correctamente', 'success')
      limpiar()
    } catch (error) {
      console.error('Error creando empleado:', error)
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
  }

  // ================================
  // Guardar edición
  // ================================
  async function guardarEdicion(e) {
    e.preventDefault()
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
      // 1. Eliminar documento
      await deleteDoc(doc(db, 'empleados', id))

      // 2. Eliminar usuario Auth
      const userToDelete = auth.currentUser
      await deleteUser(userToDelete)

      Swal.fire('Eliminado', 'Empleado borrado', 'success')
    } catch (error) {
      console.error('Error borrando empleado:', error)
      Swal.fire('Error', 'No se pudo borrar al empleado', 'error')
    }
  }

  function limpiar() {
    setModo('crear')
    setEditId(null)
    setNombre('')
    setEmail('')
    setPass('')
    setNivel('')
  }

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
              className="form-control"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">Email (login)</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={modo === 'editar'}
            />
          </div>

          {modo === 'crear' && (
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Contraseña</label>
              <input
                type="password"
                className="form-control"
                value={pass}
                onChange={e => setPass(e.target.value)}
                required
              />
            </div>
          )}

          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold">
              Permiso del empleado
            </label>
            <select
              className="form-select"
              value={nivel}
              onChange={e => setNivel(e.target.value)}
              required
            >
              <option value="">Seleccionar nivel</option>
              <option value="nivel1">Nivel 1 – Entradas</option>
              <option value="nivel2">Nivel 2 – Compras</option>
              <option value="nivel3">Nivel 3 – Entradas + Compras</option>
              <option value="nivel4">Nivel 4 – Acceso total</option>
            </select>
          </div>
        </div>

        <button className="btn btn-success mt-3">
          {modo === 'crear' ? 'Crear' : 'Guardar cambios'}
        </button>

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
