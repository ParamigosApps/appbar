// src/components/menu/UbicacionSection.jsx
import { useState } from 'react'
import './MenuSectionBase.css'

export default function UbicacionSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="menu-item-wrapper">
      <button className="menu-header" onClick={() => setOpen(!open)}>
        📍 Ubicación
        <span className={`arrow ${open ? 'open' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="menu-content">
          <p>
            <b>Dirección:</b> Buenos Aires, Argentina
          </p>

          <button
            className="btn btn-outline-dark w-100"
            data-bs-toggle="collapse"
            data-bs-target="#mapa-container"
          >
            Ver mapa
          </button>

          <div id="mapa-container" className="collapse mt-2">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3282.022302640099!2d-58.3816022!3d-34.6037037"
              width="100%"
              height="220"
              style={{ border: 0, borderRadius: '8px' }}
              allowFullScreen=""
              loading="lazy"
            ></iframe>
          </div>
        </div>
      )}
    </div>
  )
}
