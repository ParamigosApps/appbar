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
} from '../../services/pedidosService.js'
import { expirarPedidosVencidos } from '../../services/expiracionPedidos.js'
// 👀 UI opcional
import './MisPedidos.css'

// ------------------------------------------------------

export default function MisPedidos() {
  const { user } = useFirebase()

  const [pendientes, setPendientes] = useState([])
  const [pagados, setPagados] = useState([])
  const [retirados, setRetirados] = useState([])

  const expirados = pedidos.filter(p => p.estado === 'expirado')
  const [, setTick] = useState(0)

  // ==========================================
  // 🔥 Cargar pedidos del usuario
  // ==========================================
  async function cargarPedidos() {
    if (!user) return

    const pedidos = await traerPedidos(user.uid)
    const pendientesDb = await traerPedidosPendientes(user.uid)

    setPagados(pedidos.filter(p => p.estado === 'pagado'))
    setRetirados(pedidos.filter(p => p.estado === 'retirado'))
    setPendientes(pendientesDb.filter(p => p.estado === 'pendiente'))
  }
  useEffect(() => {
    const i = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)

    return () => clearInterval(i)
  }, [])
  useEffect(() => {
    if (!user) return

    async function init() {
      // 🔥 PASO 4: expirar pedidos vencidos
      await expirarPedidosVencidos()

      // 🔄 luego cargar pedidos actualizados
      await cargarPedidos()
    }

    init()
  }, [user])

  function calcularTiempoRestante(expiraEn) {
    if (!expiraEn?.seconds) return null

    const ahora = Date.now()
    const expiraMs = expiraEn.seconds * 1000
    const diff = expiraMs - ahora

    if (diff <= 0) return null

    const minutos = Math.floor(diff / 60000)
    const segundos = Math.floor((diff % 60000) / 1000)

    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(
      2,
      '0'
    )}`
  }

  // ==========================================
  // 🧾 Ver QR / Ticket
  // ==========================================
  async function verQr(pedido) {
    if (!pedido.qrUrl) {
      await Swal.fire({
        icon: 'error',
        title: 'QR no disponible',
        text: 'Este pedido no tiene QR asociado.',
        confirmButtonText: 'Cerrar',
        customClass: { confirmButton: 'btn btn-dark' },
        buttonsStyling: false,
      })
      return
    }

    await Swal.fire({
      title: `Pedido #${pedido.numeroPedido || pedido.ticketId || pedido.id}`,
      html: `
        <p><strong>Total:</strong> $${pedido.total}</p>
        <p><strong>Estado:</strong> ${pedido.estado.toUpperCase()}</p>

        <div style="margin-top:15px; text-align:center">
          <img 
            src="${pedido.qrUrl}" 
            alt="QR Pedido"
            style="width:200px;height:200px"
          />
        </div>
      `,
      width: '420px',
      confirmButtonText: 'Cerrar',
      customClass: { confirmButton: 'btn btn-dark' },
      buttonsStyling: false,
    })
  }

  // ==========================================
  // ❌ Eliminar pedido pendiente
  // ==========================================
  async function eliminarPendiente(id) {
    const res = await Swal.fire({
      title: '¿Eliminar pedido?',
      html: '<p>Esta acción no se puede deshacer.</p>',
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

    if (!res.isConfirmed) return

    cargarPedidos()
  }

  // ==========================================
  // 🧱 Render pedido
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

      <div className="pedido-bottom">
        {pedido.estado === 'pendiente' ? (
          <span className="contador">
            ⏳ {calcularTiempoRestante(pedido.expiraEn) || 'Expirando...'}
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
  // 🖥 Render final
  // ==========================================
  return (
    <div className="mis-pedidos">
      <div className="contadores">
        <div className="contador-box pendiente">
          Pendientes: {pendientes.length}
        </div>
        <div className="contador-box pagado">Pagados: {pagados.length}</div>
        <div className="contador-box retirado">
          Retirados: {retirados.length}
        </div>
      </div>

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
