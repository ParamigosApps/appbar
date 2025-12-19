import { useState } from 'react'
import './MenuSectionBase.css'

export default function RedesSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="menu-item-wrapper">
      <button className="menu-header" onClick={() => setOpen(!open)}>
        🌐 Redes Sociales
        <span className={`arrow ${open ? 'open' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="menu-content">
          <a
            href="https://instagram.com/todovaper"
            target="_blank"
            className="menu-link"
          >
            📸 Instagram
          </a>

          <a
            href="https://wa.me/5491130000000"
            target="_blank"
            className="menu-link"
          >
            💬 WhatsApp
          </a>

          <a href="mailto:contacto@todovaper.com.ar" className="menu-link">
            ✉️ Email
          </a>
        </div>
      )}
    </div>
  )
}
