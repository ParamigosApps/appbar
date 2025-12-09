// --------------------------------------------------------------
// src/components/pedidos/MisPedidos.jsx — VERSIÓN REACT FINAL
// Copia fiel del sistema viejo + expiración + ver QR
// --------------------------------------------------------------

import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import { useFirebase } from '../../context/FirebaseContext.jsx'
import {
  traerPedidos,
  traerPedidosPendientes,
  eliminarPedidoPendiente,
} from '../../services/pedidosService.js'

import { iniciarExpiracionReact } from '../../services/pedidosExpiracion.js'
import { generarCompraQr } from '../../services/generarQrService'

// 👀 UI opcional
import './MisPedidos.css'

// ------------------------------------------------------

export default function MisPedidos() {
  const { user } = useFirebase()
  const [pendientes, setPendientes] = useState([])
  const [pagados, setPagados] = useState([])
  const [retirados, setRetirados] = useState([])

  // ==========================================
  // 🔥 Cargar pedidos del usuario
  // ==========================================
  async function cargarPedidos() {
    if (!user) return

    const p = await traerPedidos(user.uid)
    const pp = await traerPedidosPendientes(user.uid)

    setPagados(p.filter(x => x.estado === 'pagado'))
    setRetirados(p.filter(x => x.estado === 'retirado'))
    setPendientes(pp.filter(x => x.estado === 'pendiente'))
  }

  useEffect(() => {
    if (user) cargarPedidos()
  }, [user])

  // ==========================================
  // 🔥 Iniciar expiración automática
  // ==========================================
  useEffect(() => {
    pendientes.forEach(pedido => {
      iniciarExpiracionReact(pedido, () => cargarPedidos())
    })
  }, [pendientes])

  // ==========================================
  // 🧾 Ver QR / Ticket
  // ==========================================
  async function verQr(pedido) {
    const container = document.createElement('div')

    await Swal.fire({
      title: `Pedido #${pedido.ticketId || pedido.id}`,
      html: `
        <p><strong>Total:</strong> $${pedido.total}</p>
        <p><strong>Estado:</strong> ${pedido.estado.toUpperCase()}</p>
        <div id="qrContainer" style="margin-top:10px;"></div>
      `,
      didOpen: async () => {
        const qrDiv = document.getElementById('qrContainer')
        await generarCompraQr({
          compraId: pedido.id,
          numeroPedido: pedido.numero, // ⚡ nuevo
          usuarioId: pedido.usuarioId, // ⚡ recomendado
          qrContainer: qrDiv,
          tamaño: 200,
        })
      },
      width: '420px',
      confirmButtonText: 'Cerrar',
      customClass: { confirmButton: 'btn btn-dark' },
      buttonsStyling: false,
    })
  }

  // ==========================================
  // ❌ Eliminar pendiente
  // ==========================================
  async function eliminarPendiente(id) {
    const ok = await Swal.fire({
      title: '¿Eliminar pedido?',
      html: `<p>Esta acción no se puede deshacer.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'btn btn-dark',
        cancelButton: 'btn btn-secondary',
      },
      buttonsStyling: false,
    })

    if (!ok.isConfirmed) return

    await eliminarPedidoPendiente(id)
    cargarPedidos()
  }

  // ==========================================
  // LIST ITEM UI
  // ==========================================
  const renderPedido = pedido => (
    <div
      key={pedido.id}
      className="pedido-item"
      style={{
        background:
          pedido.estado === 'pagado'
            ? '#c1f1cd'
            : pedido.estado === 'pendiente'
            ? '#f8e8b3'
            : '#cfcfcf',
      }}
    >
      <div className="pedido-top">
        <strong>Pedido #{pedido.ticketId || pedido.id}</strong>

        {pedido.estado === 'pendiente' && (
          <button
            className="btn-eliminar"
            onClick={() => eliminarPendiente(pedido.id)}
          >
            X
          </button>
        )}
      </div>

      <div className="pedido-info">
        <p>
          <strong>Total:</strong> ${pedido.total}
        </p>
        <p>
          <strong>Fecha:</strong> {pedido.fechaHumana || 'Fecha no disponible'}
        </p>
        <p>
          <strong>Estado:</strong>{' '}
          <span className={`estado ${pedido.estado}`}>
            {pedido.estado.toUpperCase()}
          </span>
        </p>
      </div>

      {/* FOOTER */}
      <div className="pedido-bottom">
        {pedido.estado === 'pendiente' ? (
          <span id={`exp-${pedido.id}`} className="contador">
            ⏳ Expirando...
          </span>
        ) : (
          <span className="contador invisible">.</span>
        )}

        <button className="btn-ver-qr" onClick={() => verQr(pedido)}>
          {pedido.estado !== 'retirado' ? 'Ver QR' : 'Ver ticket'}
        </button>
      </div>
    </div>
  )

  // ==========================================
  // RENDER FINAL
  // ==========================================
  return (
    <div className="mis-pedidos">
      {/* =========================== */}
      {/* CONTADORES */}
      {/* =========================== */}
      <div className="contadores">
        <div className="contador-box pendiente">
          Pendientes: {pendientes.length}
        </div>
        <div className="contador-box pagado">Pagados: {pagados.length}</div>
        <div className="contador-box retirado">
          Retirados: {retirados.length}
        </div>
      </div>

      {/* =========================== */}
      {/* LISTAS */}
      {/* =========================== */}
      <h4 className="titulo-seccion">Pendientes</h4>
      {pendientes.length === 0 ? (
        <p className="vacio">No tienes pedidos pendientes.</p>
      ) : (
        pendientes.map(renderPedido)
      )}

      <h4 className="titulo-seccion">Pagados</h4>
      {pagados.length === 0 ? (
        <p className="vacio">No tienes pedidos pagados.</p>
      ) : (
        pagados.map(renderPedido)
      )}

      <h4 className="titulo-seccion">Retirados</h4>
      {retirados.length === 0 ? (
        <p className="vacio">No tienes pedidos retirados.</p>
      ) : (
        retirados.map(renderPedido)
      )}
    </div>
  )
}
