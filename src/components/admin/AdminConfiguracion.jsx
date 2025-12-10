// -------------------------------------------------------------------
// AdminConfiguracion.jsx — Configuración total del sistema
// Permisos por nivel + Datos bancarios + Redes sociales (VERSION REAL)
// -------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { db } from '../../Firebase.js'
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'

import Swal from 'sweetalert2'

export default function AdminConfiguracion() {
  // ------------------------------------------------------------
  // ESTADOS
  // ------------------------------------------------------------
  const [permisos, setPermisos] = useState(null)

  const [datosBanco, setDatosBanco] = useState({
    aliasBanco: '',
    cbuBanco: '',
    nombreBanco: '',
    titularBanco: '',
  })

  const [social, setSocial] = useState({
    facebookContacto: '',
    instagramContacto: '',
    tiktokContacto: '',
    whatsappContacto: '',
    webContacto: '',
    xContacto: '',

    toggleFacebook: true,
    toggleInstagram: true,
    toggleTiktok: true,
    toggleWhatsapp: true,
    toggleWeb: true,
    toggleX: true,
  })

  // ------------------------------------------------------------
  // CARGAR TODA LA CONFIGURACIÓN INICIAL
  // ------------------------------------------------------------
  useEffect(() => {
    cargarPermisos()
    cargarDatosBancarios()
    cargarRedesSociales()
  }, [])

  // ------------------------------------------------------------
  async function cargarPermisos() {
    const ref = doc(db, 'configuracion', 'permisos')
    const snap = await getDoc(ref)

    if (snap.exists()) {
      setPermisos(snap.data())
    } else {
      const defaultPermisos = {
        nivel1: ['dashboard'],
        nivel2: ['dashboard', 'qr', 'caja'],
        nivel3: ['dashboard', 'qr', 'caja', 'eventos', 'productos'],
        nivel4: ['*'],
      }
      await setDoc(ref, defaultPermisos)
      setPermisos(defaultPermisos)
    }
  }

  // ------------------------------------------------------------
  async function cargarDatosBancarios() {
    const ref = doc(db, 'configuracion', 'datosBancarios')
    const snap = await getDoc(ref)
    if (snap.exists()) setDatosBanco(snap.data())
  }

  // ------------------------------------------------------------
  async function cargarRedesSociales() {
    const ref = doc(db, 'configuracion', 'social')
    const snap = await getDoc(ref)
    if (snap.exists()) setSocial(snap.data())
  }

  // ------------------------------------------------------------
  async function guardarPermisos() {
    await updateDoc(doc(db, 'configuracion', 'permisos'), permisos)
    Swal.fire('OK', 'Permisos actualizados', 'success')
  }

  async function guardarDatosBanco() {
    await setDoc(doc(db, 'configuracion', 'datosBancarios'), datosBanco)
    Swal.fire('OK', 'Datos bancarios actualizados', 'success')
  }

  async function guardarRedes() {
    await setDoc(doc(db, 'configuracion', 'social'), social)
    Swal.fire('OK', 'Redes sociales actualizadas', 'success')
  }

  // ------------------------------------------------------------
  const modulos = [
    'dashboard',
    'qr',
    'caja',
    'eventos',
    'productos',
    'empleados',
    'config',
  ]

  if (!permisos) return <p>Cargando configuración...</p>

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Configuración del Sistema</h2>

      {/* ========================================================
          SECCIÓN 1 — PERMISOS POR NIVEL
      =========================================================== */}
      <div className="card mb-4">
        <div className="card-header fw-bold">Accesos por nivel</div>
        <div className="card-body">
          {[1, 2, 3, 4].map(nivel => (
            <div key={nivel} className="mb-3 p-3 border rounded">
              <h5>Nivel {nivel}</h5>

              {modulos.map(mod => (
                <div key={mod} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={
                      permisos[`nivel${nivel}`]?.includes('*') ||
                      permisos[`nivel${nivel}`]?.includes(mod)
                    }
                    onChange={e => {
                      const lista = permisos[`nivel${nivel}`] || []
                      let nuevaLista = [...lista]

                      if (e.target.checked) nuevaLista.push(mod)
                      else nuevaLista = nuevaLista.filter(x => x !== mod)

                      setPermisos({
                        ...permisos,
                        [`nivel${nivel}`]: nuevaLista,
                      })
                    }}
                  />
                  <label className="form-check-label">{mod}</label>
                </div>
              ))}
            </div>
          ))}

          <button className="btn btn-dark mt-3" onClick={guardarPermisos}>
            Guardar accesos
          </button>
        </div>
      </div>

      {/* ========================================================
          SECCIÓN 2 — DATOS BANCARIOS
      =========================================================== */}
      <div className="card mb-4">
        <div className="card-header fw-bold">Datos bancarios</div>
        <div className="card-body">
          <input
            className="form-control mb-2"
            placeholder="CBU"
            value={datosBanco.cbuBanco}
            onChange={e =>
              setDatosBanco({ ...datosBanco, cbuBanco: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="Alias"
            value={datosBanco.aliasBanco}
            onChange={e =>
              setDatosBanco({ ...datosBanco, aliasBanco: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="Titular"
            value={datosBanco.titularBanco}
            onChange={e =>
              setDatosBanco({ ...datosBanco, titularBanco: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="Banco"
            value={datosBanco.nombreBanco}
            onChange={e =>
              setDatosBanco({ ...datosBanco, nombreBanco: e.target.value })
            }
          />

          <button className="btn btn-dark" onClick={guardarDatosBanco}>
            Guardar datos bancarios
          </button>
        </div>
      </div>

      {/* ========================================================
          SECCIÓN 3 — REDES SOCIALES
      =========================================================== */}
      <div className="card mb-4">
        <div className="card-header fw-bold">Redes sociales</div>
        <div className="card-body">
          {/* CONTACTOS */}
          <input
            className="form-control mb-2"
            placeholder="Instagram"
            value={social.instagramContacto}
            onChange={e =>
              setSocial({ ...social, instagramContacto: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="TikTok"
            value={social.tiktokContacto}
            onChange={e =>
              setSocial({ ...social, tiktokContacto: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="WhatsApp"
            value={social.whatsappContacto}
            onChange={e =>
              setSocial({ ...social, whatsappContacto: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="Facebook"
            value={social.facebookContacto}
            onChange={e =>
              setSocial({ ...social, facebookContacto: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="Web"
            value={social.webContacto}
            onChange={e =>
              setSocial({ ...social, webContacto: e.target.value })
            }
          />

          <input
            className="form-control mb-2"
            placeholder="X (Twitter)"
            value={social.xContacto}
            onChange={e => setSocial({ ...social, xContacto: e.target.value })}
          />

          {/* TOGGLES */}
          {['Facebook', 'Instagram', 'Tiktok', 'Whatsapp', 'Web', 'X'].map(
            red => (
              <div key={red} className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={social[`toggle${red}`]}
                  onChange={e =>
                    setSocial({ ...social, [`toggle${red}`]: e.target.checked })
                  }
                />
                <label className="form-check-label">Mostrar {red}</label>
              </div>
            )
          )}

          <button className="btn btn-dark mt-3" onClick={guardarRedes}>
            Guardar redes sociales
          </button>
        </div>
      </div>
    </div>
  )
}
