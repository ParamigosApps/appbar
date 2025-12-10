// components/admin/ComprasAdmin.jsx
import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../Firebase'
import Swal from 'sweetalert2'

export default function ComprasAdmin() {
  const [compras, setCompras] = useState([])
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => {
    cargarCompras()
  }, [])

  async function cargarCompras() {
    const snap = await getDocs(
      query(collection(db, 'compras'), orderBy('creadoEn', 'desc'))
    )
    setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  function verQR(compra) {
    Swal.fire({
      title: `Pedido #${compra.numeroPedido}`,
      html: `
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${compra.ticketId}">
      `,
      confirmButtonText: 'Cerrar',
    })
  }

  const filtradas =
    filtro === 'todas' ? compras : compras.filter(c => c.estado === filtro)

  return (
    <div>
      <h2 className="fw-bold mb-3">🛒 Compras (Tienda)</h2>

      {/* Filtros */}
      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-dark" onClick={() => setFiltro('todas')}>
          Todas
        </button>
        <button
          className="btn btn-outline-dark"
          onClick={() => setFiltro('pendiente')}
        >
          Pendientes
        </button>
        <button
          className="btn btn-outline-dark"
          onClick={() => setFiltro('retirado')}
        >
          Retiradas
        </button>
      </div>

      {/* Lista */}
      <div className="lista-admin">
        {filtradas.map(c => (
          <div key={c.id} className="admin-card">
            <div className="fw-bold">Pedido #{c.numeroPedido}</div>

            <div className="small text-muted">{c.usuarioNombre}</div>

            <div className="mt-2">Total: ${c.total}</div>
            <div className="text-muted">Estado: {c.estado}</div>

            <button
              className="btn btn-dark w-100 mt-2"
              onClick={() => verQR(c)}
            >
              Ver QR
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
