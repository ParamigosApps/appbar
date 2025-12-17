import { useEffect, useState } from 'react'
import { db } from '../../Firebase.js'
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { swalSuccess, swalError } from '../../utils/swalUtils.js'
// ============================================================
// HELPERS VALIDACIÓN
// ============================================================
const toStr = v => (typeof v === 'string' ? v.trim() : '')

const esUrlValida = v => {
  const s = toStr(v)
  if (!s) return false
  return /^https?:\/\/.+\..+/i.test(s)
}

const esWhatsappValido = v => {
  const s = toStr(v)
  if (!s) return false
  return /^[0-9]{8,15}$/.test(s)
}

const esCbuValido = v => {
  const s = toStr(v)
  if (!s) return false
  return /^[0-9]{22}$/.test(s)
}

// ============================================================
// COMPONENTE SECCIÓN (ACORDEÓN)
// ============================================================
function Seccion({ title, open, onToggle, completo, children }) {
  return (
    <div className={`seccion-card ${open ? 'open' : ''}`}>
      <div
        className="seccion-header"
        onClick={onToggle}
        role="button"
        aria-expanded={open}
      >
        <div className="seccion-title">{title}</div>

        <div className={`seccion-status ${completo ? 'ok' : 'pending'}`}>
          <span className="status-dot" />
          <span className="status-text">
            {completo ? 'Completo' : 'Incompleto'}
          </span>
          <span className="chevron">{open ? '▾' : '▸'}</span>
        </div>
      </div>

      <div
        className="seccion-body"
        style={{
          maxHeight: open ? '1200px' : '0',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="seccion-body-inner">{children}</div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
export default function AdminConfiguracion() {
  const [open, setOpen] = useState({
    permisos: false,
    banco: false,
    redes: false,
  })

  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }))

  const [permisos, setPermisos] = useState(null)

  const [datosBanco, setDatosBanco] = useState({
    aliasBanco: '',
    cbuBanco: '',
    nombreBanco: '',
    titularBanco: '',
  })

  const [social, setSocial] = useState({
    instagramContacto: '',
    tiktokContacto: '',
    whatsappContacto: '',
    facebookContacto: '',
    webContacto: '',
    xContacto: '',
  })

  // ============================================================
  // CARGA INICIAL
  // ============================================================
  useEffect(() => {
    cargarPermisos()
    cargarDatosBancarios()
    cargarRedes()
  }, [])

  async function cargarPermisos() {
    const ref = doc(db, 'configuracion', 'permisos')
    const snap = await getDoc(ref)

    if (snap.exists()) {
      setPermisos(snap.data())
    } else {
      const base = {
        nivel1: ['dashboard'],
        nivel2: ['dashboard', 'qr', 'caja'],
        nivel3: ['dashboard', 'qr', 'caja', 'eventos', 'productos'],
        nivel4: ['*'],
      }
      await setDoc(ref, base)
      setPermisos(base)
    }
  }

  async function cargarDatosBancarios() {
    const snap = await getDoc(doc(db, 'configuracion', 'datosBancarios'))
    if (snap.exists()) setDatosBanco(snap.data())
  }

  async function cargarRedes() {
    const snap = await getDoc(doc(db, 'configuracion', 'social'))
    if (snap.exists()) setSocial(snap.data())
  }

  // ============================================================
  // GUARDAR
  // ============================================================
  async function guardarPermisos() {
    await updateDoc(doc(db, 'configuracion', 'permisos'), permisos)
    swalSuccess({
      title: 'Accesos de empleados',
      text: 'Actualizados con exito',
    })
  }

  async function guardarBanco() {
    if (!esCbuValido(datosBanco.cbuBanco)) {
      swalError({
        title: 'Error',
        text: 'CBU inválido (22 dígitos)',
      })
      return
    }

    await setDoc(doc(db, 'configuracion', 'datosBancarios'), datosBanco)
    swalSuccess({
      title: 'Datos bancarios',
      text: 'Actualizados con exito',
    })
  }

  async function guardarRedes() {
    await setDoc(doc(db, 'configuracion', 'social'), social)

    swalSuccess({
      title: 'Redes sociales',
      text: 'Actualizadas con exito',
    })
  }

  if (!permisos) return <p>Cargando configuración...</p>

  // ============================================================
  // INDICADORES
  // ============================================================
  const bancoCompleto =
    datosBanco.aliasBanco &&
    esCbuValido(datosBanco.cbuBanco) &&
    datosBanco.titularBanco &&
    datosBanco.nombreBanco

  const redesCompletas = Object.entries(social).every(([k, v]) => {
    if (!v) return true
    if (k === 'whatsappContacto') return esWhatsappValido(v)
    return esUrlValida(v)
  })

  const modulos = [
    'dashboard',
    'qr',
    'caja',
    'eventos',
    'productos',
    'empleados',
    'config',
  ]

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Configuración del sistema</h2>

      {/* ===================================================== */}
      <Seccion
        title="Accesos por nivel"
        open={open.permisos}
        onToggle={() => toggle('permisos')}
        completo
      >
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
                    let nueva = [...lista]

                    if (e.target.checked) nueva.push(mod)
                    else nueva = nueva.filter(x => x !== mod)

                    setPermisos({
                      ...permisos,
                      [`nivel${nivel}`]: nueva,
                    })
                  }}
                />
                <label className="form-check-label">{mod}</label>
              </div>
            ))}
          </div>
        ))}

        <div className="mt-1 d-flex justify-content-center">
          <button className="btn swal-btn-confirm" onClick={guardarPermisos}>
            Guardar accesos
          </button>
        </div>
      </Seccion>

      {/* ===================================================== */}
      <Seccion
        title="Datos bancarios"
        open={open.banco}
        onToggle={() => toggle('banco')}
        completo={bancoCompleto}
      >
        {[
          ['cbuBanco', 'CBU (22 dígitos)'],
          ['aliasBanco', 'Alias'],
          ['titularBanco', 'Titular'],
          ['nombreBanco', 'Banco'],
        ].map(([k, label]) => (
          <input
            key={k}
            className="form-control mb-2"
            placeholder={label}
            value={datosBanco[k] || ''}
            onChange={e =>
              setDatosBanco({ ...datosBanco, [k]: e.target.value })
            }
          />
        ))}
        {/* SUBMIT */}
        <div className="form-divider my-3" />
        <div className="mt-1 d-flex justify-content-center">
          <button className="btn swal-btn-confirm " onClick={guardarBanco}>
            Guardar datos
          </button>
        </div>
      </Seccion>

      {/* ===================================================== */}
      <Seccion
        title="Redes sociales"
        open={open.redes}
        onToggle={() => toggle('redes')}
        completo={redesCompletas}
      >
        {[
          ['instagramContacto', 'Instagram (URL)'],
          ['tiktokContacto', 'TikTok (URL)'],
          ['facebookContacto', 'Facebook (URL)'],
          ['xContacto', 'X / Twitter (URL)'],
          ['webContacto', 'Web (URL)'],
          ['whatsappContacto', 'WhatsApp (solo números)'],
        ].map(([k, label]) => (
          <input
            key={k}
            className="form-control mb-2"
            placeholder={label}
            value={social[k] || ''}
            onChange={e => setSocial({ ...social, [k]: e.target.value })}
          />
        ))}
        {/* SUBMIT */}
        <div className="form-divider my-3" />
        <div className="mt-1 d-flex justify-content-center">
          <button className="btn swal-btn-confirm" onClick={guardarRedes}>
            Guardar datos
          </button>
        </div>
      </Seccion>
    </div>
  )
}
