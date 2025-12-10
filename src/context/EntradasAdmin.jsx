// components/admin/EntradasAdmin.jsx
import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../Firebase'
import Swal from 'sweetalert2'

export default function EntradasAdmin() {
  const [entradas, setEntradas] = useState([])
  const [eventos, setEventos] = useState([])
  const [eventoSel, setEventoSel] = useState('todos')
  const [estadoSel, setEstadoSel] = useState('todas')

  useEffect(() => {
    cargarEventos()
    cargarEntradas()
  }, [])

  async function cargarEventos() {
    const snap = await getDocs(collection(db, 'eventos'))
    setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function cargarEntradas() {
    const snap = await getDocs(collection(db, 'entradas'))
    setEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  function verQR(en) {
    Swal.fire({
      title: `${en.usuarioNombre}`,
      html: `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${en.id}">
      `,
      confirmButtonText: 'Cerrar',
    })
  }

  const filtradas = entradas.filter(en => {
    if (eventoSel !== 'todos' && en.eventoId !== eventoSel) return false
    if (estadoSel === 'usada' && !en.usado) return false
    if (estadoSel === 'sin-usar' && en.usado) return false
    return true
  })

  return (
    <div>
      <h2 className="fw-bold mb-3">🎟 Entradas (Eventos)</h2>

      {/* Filtro por evento */}
      <select
        className="form-select mb-3"
        value={eventoSel}
        onChange={e => setEventoSel(e.target.value)}
      >
        <option value="todos">Todos los eventos</option>
        {eventos.map(ev => (
          <option key={ev.id} value={ev.id}>
            {ev.nombre}
          </option>
        ))}
      </select>

      {/* Filtro por estado */}
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-dark" onClick={() => setEstadoSel('todas')}>
          Todas
        </button>
        <button
          className="btn btn-outline-dark"
          onClick={() => setEstadoSel('usada')}
        >
          Usadas
        </button>
        <button
          className="btn btn-outline-dark"
          onClick={() => setEstadoSel('sin-usar')}
        >
          Sin usar
        </button>
      </div>

      <div className="lista-admin">
        {filtradas.map(en => (
          <div key={en.id} className="admin-card">
            <strong>{en.nombreEvento}</strong>
            <div className="small text-muted">{en.usuarioNombre}</div>
            <div className="mt-1">
              Estado: {en.usado ? 'Usada' : 'Sin usar'}
            </div>

            <button
              className="btn btn-dark w-100 mt-2"
              onClick={() => verQR(en)}
            >
              Ver QR
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
