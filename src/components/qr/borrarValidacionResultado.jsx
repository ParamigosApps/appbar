// --------------------------------------------------------------
// src/components/qr/ValidacionResultado.jsx — CARD RESULTADO
// --------------------------------------------------------------
import React from 'react'

function colorFondo(color) {
  switch (color) {
    case 'green':
      return '#d1f2d1'
    case 'pink':
      return '#ffd6ec'
    case 'purple':
      return '#e3d4ff'
    case 'blue':
      return '#d4e8ff'
    case 'yellow':
      return '#fff3cd'
    case 'red':
    default:
      return '#f8d7da'
  }
}

export default function ValidacionResultado({
  resultado,
  modo,
  onMarcarUsada,
  onCerrar,
}) {
  if (!resultado) return null

  const { color, titulo, mensaje, tipo, estado, data } = resultado
  const bg = colorFondo(color)

  const esEntradaOk = tipo === 'entrada' && estado === 'ok'
  const esCompraOk = tipo === 'compra' && estado === 'ok'

  return (
    <div
      className="mt-3 p-3 rounded"
      style={{
        background: bg,
        border: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h5 className="mb-1">{titulo}</h5>
          <div style={{ fontSize: '.9rem' }}>{mensaje}</div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onCerrar}
        >
          Cerrar
        </button>
      </div>

      {/* INFO EXTRA */}
      {data && (
        <div className="mt-2" style={{ fontSize: '.82rem', color: '#333' }}>
          {data.nombreEvento && (
            <div>
              <b>Evento:</b> {data.nombreEvento}
            </div>
          )}
          {data.loteNombre && (
            <div>
              <b>Lote:</b> {data.loteNombre}
            </div>
          )}
          {data.precio !== undefined && (
            <div>
              <b>Precio:</b> ${Number(data.precio || 0).toLocaleString('es-AR')}
            </div>
          )}
          {data.usuarioNombre && (
            <div>
              <b>Usuario:</b> {data.usuarioNombre}
            </div>
          )}
          {data.dni && (
            <div>
              <b>DNI:</b> {data.dni}
            </div>
          )}
        </div>
      )}

      {/* BOTONES DE ACCIÓN */}
      <div className="mt-3 d-flex gap-2">
        {modo === 'entradas' && esEntradaOk && (
          <button
            type="button"
            className="btn btn-sm btn-success"
            onClick={onMarcarUsada}
          >
            Marcar entrada como usada
          </button>
        )}

        {modo === 'caja' && esCompraOk && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onMarcarUsada}
          >
            Marcar compra como retirada
          </button>
        )}
      </div>
    </div>
  )
}
