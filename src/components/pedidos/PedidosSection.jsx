// --------------------------------------------------------------
// src/components/pedidos/PedidosSection.jsx — VERSIÓN FINAL COMPLETA
// --------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'

import { usePedidos } from '../../context/PedidosContext.jsx'
import { useCarrito } from '../../context/CarritoContext.jsx'

import { mostrarQrCompraReact } from '../qr/ModalQrCompra.jsx'
import { formatearFecha } from '../../utils/utils.js'

// ===================================================================
// 🔵 COMPONENTE: Botón Collapse
// ===================================================================
function BotonCollapse({ label, open, count, color, onClick }) {
  return (
    <button
      className={
        'btn btn-outline-dark w-100 mb-2 position-relative btn-collapse ' +
        (open ? '' : 'collapsed')
      }
      type="button"
      onClick={onClick}
    >
      {label}
      <span className="flecha"></span>

      <span
        className={
          'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-' +
          color
        }
      >
        {count}
      </span>
    </button>
  )
}

// ===================================================================
// 🔵 LISTA DE PEDIDOS
// ===================================================================
function ListaPedidos({ items, onEliminar, onExpirar }) {
  return (
    <div className="lista-pedidos">
      {items.length === 0 ? (
        <p className="text-muted text-center">No hay pedidos.</p>
      ) : (
        items.map(p => (
          <PedidoCard
            key={p.id}
            pedido={p}
            onEliminar={onEliminar}
            onExpirar={onExpirar}
          />
        ))
      )}
    </div>
  )
}

// ===================================================================
// 🔵 TARJETA DE PEDIDO
// ===================================================================
function PedidoCard({ pedido, onEliminar, onExpirar }) {
  const { abrirPendientes } = usePedidos()

  const [textoExpira, setTextoExpira] = useState('')
  const esPendiente = pedido.estado === 'pendiente'
  const { cerrarCarrito, abrirCarrito } = useCarrito()

  // ----------------------------------------------------------
  // contador "expira en mm:ss"
  // ----------------------------------------------------------
  useEffect(() => {
    if (!esPendiente) {
      setTextoExpira('')
      return
    }

    const base =
      pedido.creadoEn?.toDate?.() ??
      pedido.fecha?.toDate?.() ??
      new Date(pedido.fecha)

    const expiraEnMs = base.getTime() + 15 * 60 * 1000

    const tick = () => {
      const diff = expiraEnMs - Date.now()
      if (diff <= 0) {
        setTextoExpira('⛔ Expirado')
        onExpirar?.(pedido)
        return false
      }
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setTextoExpira(`⏳ Expira en ${min}:${String(sec).padStart(2, '0')}`)
      return true
    }

    tick()
    const id = setInterval(() => {
      if (!tick()) clearInterval(id)
    }, 1000)

    return () => clearInterval(id)
  }, [pedido, esPendiente, onExpirar])

  // ----------------------------------------------------------
  // ver ticket
  // ----------------------------------------------------------
  const handleVerTicket = async e => {
    e.stopPropagation()

    cerrarCarrito()

    await mostrarQrCompraReact(
      {
        carrito: pedido.items,
        total: pedido.total,
        ticketId: pedido.ticketId,
        numeroPedido: pedido.numeroPedido,
        estado: pedido.estado,
        lugar: pedido.lugar || 'Tienda',
        fechaHumana: pedido.creadoEn?.toDate
          ? formatearFecha(pedido.creadoEn.toDate())
          : formatearFecha(pedido.fecha),
        usuarioNombre: pedido.usuarioNombre || 'Usuario',
      },
      () => abrirCarrito() // ← SE REABRE AL CERRAR EL MODAL
    )

    abrirPendientes()
  }

  // ----------------------------------------------------------
  // eliminar
  // ----------------------------------------------------------
  const handleEliminar = async e => {
    e.stopPropagation()

    const r = await Swal.fire({
      title: '¿Eliminar pedido?',
      html: 'Esta acción no se puede deshacer.',
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

    if (r.isConfirmed) await onEliminar?.(pedido)
  }

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------
  return (
    <div className="pedido-item p-2 mb-2 rounded position-relative">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid #ddd',
          paddingBottom: 6,
        }}
      >
        <strong style={{ fontSize: 18 }}>PEDIDO #{pedido.numeroPedido}</strong>

        {esPendiente && (
          <button
            className="btn btn-sm btn-danger"
            onClick={handleEliminar}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            X
          </button>
        )}
      </div>

      <div style={{ fontSize: 14, marginTop: 6 }}>
        <p>
          <strong>Total:</strong> ${pedido.total}
        </p>

        <p>
          <strong>Fecha:</strong>{' '}
          {pedido.fecha?.toDate
            ? formatearFecha(pedido.fecha.toDate())
            : formatearFecha(pedido.fecha)}
        </p>

        <p style={{ marginTop: 6 }}>
          <strong>Estado:</strong>{' '}
          <span
            style={{
              background:
                pedido.estado === 'pagado'
                  ? '#42b14d'
                  : pedido.estado === 'pendiente'
                  ? '#fac834'
                  : '#ddd',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {pedido.estado.toUpperCase()}
          </span>
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          alignItems: 'center',
        }}
      >
        {esPendiente ? (
          <p
            style={{
              fontWeight: 'bold',
              color: '#c40b1d',
              margin: 0,
              fontSize: 16,
            }}
          >
            {textoExpira || '⏳ Calculando...'}
          </p>
        ) : (
          <span style={{ visibility: 'hidden' }}>placeholder</span>
        )}

        <button
          className="btn btn-dark btn-sm"
          style={{ padding: '5px 14px', fontSize: 12 }}
          onClick={handleVerTicket}
        >
          Ver ticket
        </button>
      </div>
    </div>
  )
}

// ===================================================================
// 🔵 SECCIÓN PRINCIPAL
// ===================================================================
export default function PedidosSection() {
  const {
    pedidosPendientes,
    pedidosPagados,
    pedidosRetirados,
    loadingPedidos,
    procesarExpiracion,
    eliminarPedido,
    abiertos,
    setAbiertos,
  } = usePedidos()

  const toggle = k =>
    setAbiertos(prev => ({
      ...prev,
      [k]: !prev[k],
    }))

  if (loadingPedidos) {
    return <p className="text-center text-muted p-3">Cargando pedidos...</p>
  }

  return (
    <section id="container-pedidos" className="p-3">
      {/* PAGADOS */}
      <BotonCollapse
        label="Pedidos pagados"
        open={abiertos.pagados}
        count={pedidosPagados.length}
        color="success"
        onClick={() => toggle('pagados')}
      />
      {abiertos.pagados && (
        <ListaPedidos items={pedidosPagados} onEliminar={eliminarPedido} />
      )}

      {/* PENDIENTES */}
      <BotonCollapse
        label="Pedidos pendientes"
        open={abiertos.pendientes}
        count={pedidosPendientes.length}
        color="danger"
        onClick={() => toggle('pendientes')}
      />
      {abiertos.pendientes && (
        <ListaPedidos
          items={pedidosPendientes}
          onEliminar={eliminarPedido}
          onExpirar={procesarExpiracion}
        />
      )}

      {/* RETIRADOS */}
      <BotonCollapse
        label="Pedidos retirados"
        open={abiertos.retirados}
        count={pedidosRetirados.length}
        color="secondary"
        onClick={() => toggle('retirados')}
      />
      {abiertos.retirados && (
        <ListaPedidos items={pedidosRetirados} onEliminar={eliminarPedido} />
      )}
    </section>
  )
}
