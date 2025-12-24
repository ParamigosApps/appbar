// --------------------------------------------------------------
// src/components/admin/EntradasAdmin.jsx — PANEL ENTRADAS ADMIN (PRO)
// --------------------------------------------------------------
import { useState } from 'react'
import EntradasPendientes from './EntradasPendientes.jsx'
import EntradasVendidas from './EntradasVendidas.jsx'

export default function EntradasAdmin() {
  const [tab, setTab] = useState('pendientes')

  return (
    <div className="entradas-admin-page">
      <div className="entradas-admin-container">
        <h2 className="fw-bold mb-4 text-center">Gestión de Entradas</h2>

        {/* ----------- TABS ----------- */}
        <div className="entradas-tabs">
          <button
            className={
              'entradas-tab-btn ' + (tab === 'pendientes' ? 'active' : '')
            }
            onClick={() => setTab('pendientes')}
          >
            Pendientes de aprobación
          </button>

          <button
            className={
              'entradas-tab-btn ' + (tab === 'vendidas' ? 'active' : '')
            }
            onClick={() => setTab('vendidas')}
          >
            🎟 Vendidas / Aprobadas
          </button>
        </div>

        {/* ----------- CONTENIDO ----------- */}
        <div className="entradas-admin-content">
          {tab === 'pendientes' && <EntradasPendientes />}
          {tab === 'vendidas' && <EntradasVendidas />}
        </div>
      </div>
    </div>
  )
}
