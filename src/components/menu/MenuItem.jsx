// src/components/menu/MenuItem.jsx
import { useState } from 'react'
import './MenuCliente.css'

export default function MenuItem({ title, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="menu-item">
      <button className="menu-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={`arrow ${open ? 'open' : ''}`}>▼</span>
      </button>

      {open && <div className="menu-content">{children}</div>}
    </div>
  )
}
