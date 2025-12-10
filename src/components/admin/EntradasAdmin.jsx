// --------------------------------------------------------------
// src/components/admin/EntradasAdmin.jsx — PANEL ENTRADAS ADMIN
// --------------------------------------------------------------
import { useState } from 'react'
import EntradasPendientes from './EntradasPendientes.jsx'
import EntradasVendidas from './EntradasVendidas.jsx'

export default function EntradasAdmin() {
  const [tab, setTab] = useState('pendientes')

  return (
    <div className="container py-3">
      <h2 className="fw-bold mb-4">Gestión de Entradas</h2>

      {/* ---------------- TABS ---------------- */}
      <div className="admin-tabs d-flex gap-2 mb-4">
        <button
          className={'admin-tab-btn ' + (tab === 'pendientes' ? 'active' : '')}
          onClick={() => setTab('pendientes')}
        >
          🔄 Pendientes
        </button>

        <button
          className={'admin-tab-btn ' + (tab === 'vendidas' ? 'active' : '')}
          onClick={() => setTab('vendidas')}
        >
          🎟 Vendidas / Aprobadas
        </button>
      </div>

      {/* ---------------- CONTENIDO ---------------- */}
      <div className="admin-content">
        {tab === 'pendientes' && <EntradasPendientes />}
        {tab === 'vendidas' && <EntradasVendidas />}
      </div>
    </div>
  )
}
