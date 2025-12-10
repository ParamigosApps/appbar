// --------------------------------------------------------------
// ModalSeleccionLote.jsx — PREMIUM UI 2025
// --------------------------------------------------------------
import React from 'react'
import './ModalEntradas.css'
import { useEntradas } from '../../context/EntradasContext.jsx'

export default function ModalSeleccionLote() {
  const { modalSeleccion } = useEntradas()
  const { visible, lotes, evento, onSelect, onClose } = modalSeleccion

  if (!visible) return null

  // vibración PRO
  const vibrar = () => {
    if (navigator.vibrate) navigator.vibrate(30)
  }

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-card slide-up">
        {/* TÍTULO */}
        <h3 className="modal-title">Seleccioná tu lote</h3>
        <p className="modal-sub">{evento?.nombre}</p>

        <div className="modal-lotes-container">
          {lotes.map((l, i) => {
            const agotado = l.restantes <= 0
            const casi = l.restantes > 0 && l.restantes <= 5
            const mejorPrecio = i === 0 || l.precio <= lotes[0].precio

            return (
              <div
                key={i}
                className={`lote-card premium 
                  ${agotado ? 'disabled' : ''}
                  ${casi ? 'casi-agotado' : ''}`}
                onClick={() => {
                  if (!agotado) {
                    vibrar()
                    onSelect(i)
                  }
                }}
              >
                {/* INFO */}
                <div className="lote-info">
                  <span className="lote-nombre">
                    {l.nombre || `Lote ${i + 1}`}
                  </span>

                  <span className="lote-precio">💵 ${l.precio}</span>

                  <span className="lote-restantes">
                    Restantes: {l.restantes}/{l.cantidad}
                  </span>

                  {l.incluyeConsumicion && (
                    <span className="tag-consumicion">
                      🍹 Incluye consumición
                    </span>
                  )}
                </div>

                {/* BADGE */}
                <div className="badges-container">
                  {mejorPrecio && !agotado && (
                    <span className="badge-recomendado">🔥 Mejor precio</span>
                  )}
                  {casi && !agotado && (
                    <span className="badge-ultimo">⏳ Últimos</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button className="modal-btn-cancel" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
