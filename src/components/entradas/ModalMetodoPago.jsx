// --------------------------------------------------------------
// ModalMetodoPago.jsx — PREMIUM UI 2025
// --------------------------------------------------------------
import React, { useState, useEffect } from 'react'
import './ModalEntradas.css'
import { useEntradas } from '../../context/EntradasContext.jsx'

export default function ModalMetodoPago() {
  const { modalPago } = useEntradas()
  const { visible, evento, lote, precio, maxCantidad, onResult } = modalPago

  const [cantidad, setCantidad] = useState(1)

  useEffect(() => {
    if (visible) setCantidad(1)
  }, [visible])

  if (!visible) return null

  const handleCantidad = e => {
    let val = Number(e.target.value)
    if (val < 1) val = 1
    if (val > maxCantidad) val = maxCantidad
    setCantidad(val)
  }

  // vibración leve PRO
  const vibrar = () => {
    if (navigator.vibrate) navigator.vibrate(30)
  }

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-card slide-up">
        {/* Título */}
        <h3 className="modal-title">{evento?.nombre}</h3>
        <p className="modal-sub">Elegí la cantidad y el método de pago</p>

        {/* Tarjeta Premium de detalle */}
        <div className="entrada-card premium">
          <div className="entrada-info">
            <span className="entrada-titulo">
              {lote ? lote.nombre : 'General'}
            </span>

            <span className="entrada-sub">
              Precio: <b>${precio}</b>
            </span>

            {lote?.incluyeConsumicion && (
              <span className="tag-consumicion">🍹 Incluye consumición</span>
            )}
          </div>

          {/* Badge recomendado */}
          {precio <= 4000 && (
            <span className="badge-recomendado">🔥 Recomendado</span>
          )}
        </div>

        {/* Barra de cupos */}
        {lote && (
          <div className="barra-cupos">
            <div
              className="barra-cupos-fill"
              style={{
                width: `${(lote.restantes / lote.cantidad) * 100}%`,
              }}
            ></div>
          </div>
        )}

        {/* Cantidad */}
        <label className="label">Cantidad (máx {maxCantidad})</label>

        <input
          type="number"
          min="1"
          max={maxCantidad}
          value={cantidad}
          onChange={handleCantidad}
          className="modal-input"
        />

        {/* Total */}
        <p className="total">
          Total: <strong>${cantidad * precio}</strong>
        </p>

        {/* Botones */}
        <div className="modal-buttons">
          <button
            className="btn-mp"
            onClick={() => {
              vibrar()
              onResult({ metodo: 'mp', cantidad })
            }}
          >
            💳 Mercado Pago
          </button>

          <button
            className="btn-transfer"
            onClick={() => {
              vibrar()
              onResult({ metodo: 'transfer', cantidad })
            }}
          >
            🔄 Transferencia
          </button>
        </div>

        <button className="modal-btn-cancel" onClick={() => onResult(null)}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
