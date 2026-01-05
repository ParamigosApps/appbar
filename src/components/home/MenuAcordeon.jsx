// --------------------------------------------------------------
// src/components/home/MenuAcordeon.jsx — VERSIÓN FINAL 2025
// --------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { useCatalogo } from '../../context/CatalogoContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEntradas } from '../../context/EntradasContext.jsx'
import HistorialEntradas from '../entradas/HistorialEntradas.jsx'
import EntradasEventos from '../entradas/EntradasEventos.jsx'
import MisEntradas from '../entradas/MisEntradas.jsx'
import RedesSociales from '../home/RedesSociales.jsx'
import { useEvento } from '../../context/EventosContext.jsx'
// Íconos
import googleIcon from '../../assets/img/google.png'
import facebookIcon from '../../assets/img/facebook.png'

import { db } from '../../Firebase.js'
import { doc, getDoc } from 'firebase/firestore'

import { swalConfirmWarning } from '../../utils/swalUtils.js'
// --------------------------------------------------------------
// ÍCONOS DE CATEGORÍAS
// --------------------------------------------------------------
const iconosCategorias = {
  tragos: '🥂',
  botellas: '🍾',
  'sin alcohol': '⚡︎',
  combos: '🎉',
  promos: '🏷️',
  accesorios: '🧋',
}

const obtenerIcono = cat => iconosCategorias[cat] || ''

const normalizar = str => String(str).toLowerCase()

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
export default function MenuAcordeon() {
  const [abierto, setAbierto] = useState(null)
  const [entradasInterno, setEntradasInterno] = useState(null)
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [mostrarTelefono, setMostrarTelefono] = useState(false)
  const [ubicacion, setUbicacion] = useState({
    mapsEmbedUrl: '',
    mapsLink: '',
  })

  const [ubicacionCargada, setUbicacionCargada] = useState(false)

  const [smsEnviado, setSmsEnviado] = useState(false)
  const [smsError, setSmsError] = useState(false)

  const toggle = key => setAbierto(prev => (prev === key ? null : key))
  const {
    categorias,
    categoriaActiva,
    seleccionarCategoria,
    toggleCatalogo,
    productosFiltrados,
    catalogoVisible,
    abrirProductoDetalle,
  } = useCatalogo()
  const { evento, hayEventosVigentes, pedirSeleccionEvento } = useEvento()
  const { eventos, misEntradas } = useEntradas()

  const {
    user,
    loginSettings,
    loginGoogle,
    loginFacebook,
    loginEmailEnviarLink,
    loginTelefonoEnviarCodigo,
    loginTelefonoValidarCodigo,
    logout,
    loading,
    puedeEditarPerfil,
  } = useAuth()
  const contadorMisEntradas = misEntradas?.length ?? 0

  // ------------------------------------------------------------
  // Evento global para abrir login
  // ------------------------------------------------------------
  useEffect(() => {
    const handler = () => {
      setAbierto('usuario') // 🔒 abrir SIEMPRE
      setMostrarTelefono(false) // opcional, limpia estado
      setSmsEnviado(false)
      setSmsError(false)
    }

    document.addEventListener('abrir-login', handler)
    return () => document.removeEventListener('abrir-login', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      setAbierto(prev => (prev === 'catalogo' ? null : prev))
    }

    document.addEventListener('cerrar-catalogo', handler)
    return () => document.removeEventListener('cerrar-catalogo', handler)
  }, [])
  useEffect(() => {
    const handler = () => {
      setAbierto(prev => (prev === 'catalogo' ? prev : 'catalogo'))
    }

    document.addEventListener('abrir-catalogo', handler)
    return () => document.removeEventListener('abrir-catalogo', handler)
  }, [])

  // ------------------------------------------------------------
  // NUEVO: Evento global "abrir-mis-entradas"
  // ------------------------------------------------------------
  useEffect(() => {
    const handler = () => {
      setAbierto('entradas') // abre acordeón principal
      setEntradasInterno('mis') // selecciona pestaña "Mis Entradas"
    }

    document.addEventListener('abrir-mis-entradas', handler)
    return () => document.removeEventListener('abrir-mis-entradas', handler)
  }, [])

  useEffect(() => {
    async function cargarUbicacion() {
      const ref = doc(db, 'configuracion', 'ubicacion')
      const snap = await getDoc(ref)

      if (snap.exists()) {
        setUbicacion({
          mapsEmbedUrl: snap.data().mapsEmbedUrl || '',
          mapsLink: snap.data().mapsLink || '',
        })
      }

      setUbicacionCargada(true)
    }

    cargarUbicacion()
  }, [])

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <main className="menu-desplegable flex-grow-1">
      <div className="catalogo my-2">
        <div className="accordion shadow-sm rounded-4 overflow-hidden w-100">
          {/* ======================================================
              CATÁLOGO
          ======================================================= */}
          <div className="accordion-item">
            <h2 className="accordion-header">
              <button
                data-accordion-target="catalogo"
                className={`accordion-button ${
                  abierto === 'catalogo' ? '' : 'collapsed'
                }`}
                onClick={async () => {
                  // Si NO está abierto todavía
                  if (abierto !== 'catalogo') {
                    // 2️⃣ Hay eventos pero NO hay evento seleccionado → pedirlo
                    if (!evento) {
                      const ok = await pedirSeleccionEvento()
                      if (!ok) return // ⛔ si cancela, no abrir acordeón
                    }
                    // 1️⃣ No hay eventos vigentes → no abrir
                    if (hayEventosVigentes === false) {
                      return
                    }
                  }

                  // 3️⃣ Abrir / cerrar acordeón normalmente
                  toggle('catalogo')
                }}
              >
                🍾 Catálogo
              </button>
            </h2>

            {abierto === 'catalogo' && (
              <div className="accordion-collapse show">
                <div className="accordion-body d-grid gap-3">
                  <button
                    className="btn btn-outline-dark w-100"
                    onClick={toggleCatalogo}
                  >
                    Ver catálogo completo
                  </button>

                  <div className="categorias-container">
                    {(categorias ?? [])
                      .filter(cat => cat !== 'Todos')
                      .map(cat => {
                        const icon = iconosCategorias[cat.toLowerCase()] || '❓'

                        return (
                          <button
                            key={cat}
                            className={`categoria-btn ${
                              categoriaActiva === cat ? 'active' : ''
                            }`}
                            onClick={async () => {
                              seleccionarCategoria(cat)
                            }}
                          >
                            <span className="categoria-icon">{icon}</span>
                            <span className="categoria-label">{cat}</span>
                          </button>
                        )
                      })}
                  </div>

                  <div className="text-start mb-2 text-muted">
                    {hayEventosVigentes === false ? (
                      <>
                        ⚠️ <strong>No hay eventos activos</strong> en este
                        momento.
                      </>
                    ) : !evento ? (
                      <>
                        <strong>Seleccioná un evento</strong> para ver el
                        catálogo.
                      </>
                    ) : categoriaActiva === 'Todos' ? (
                      catalogoVisible ? (
                        <>
                          🔎 Mostrando el <strong>Catálogo Completo</strong>
                        </>
                      ) : (
                        <>Seleccione una categoría o catálogo completo.</>
                      )
                    ) : (
                      <>
                        🔎 Filtrado por:{' '}
                        <strong>
                          {obtenerIcono(normalizar(categoriaActiva))}{' '}
                          {categoriaActiva}
                        </strong>
                      </>
                    )}
                  </div>

                  {catalogoVisible && (
                    <div className="catalogoContainer my-2">
                      {/* Si está todo el catálogo → agrupar por categoría */}
                      {categoriaActiva === 'Todos' ? (
                        categorias
                          ?.filter(cat => cat !== 'Todos')
                          .map(cat => {
                            const productosCat = productosFiltrados.filter(
                              p =>
                                p.categoria?.toLowerCase() === cat.toLowerCase()
                            )

                            if (productosCat.length === 0) return null

                            return (
                              <div key={cat} className="mb-4">
                                {/* Título de la categoría */}
                                <h5 className="catalogo-subtitulo">
                                  {obtenerIcono(normalizar(cat))} {cat}
                                </h5>

                                {/* Grilla independiente por categoría */}
                                <div className="catalogo-grid">
                                  {productosCat.map(p => (
                                    <div
                                      key={p.id}
                                      className={`product-card ${
                                        p.stock === 0
                                          ? 'producto-sin-stock sin-click'
                                          : ''
                                      }`}
                                      onClick={() => abrirProductoDetalle(p)}
                                    >
                                      <img
                                        src={p.imgSrc}
                                        alt={p.nombre}
                                        className="img-producto-carrito"
                                      />
                                      <div className="product-info">
                                        <h3>{p.nombre}</h3>
                                        <p>{p.descripcion}</p>
                                        <h5>${p.precio}</h5>
                                      </div>
                                      {p.stock === 0 && (
                                        <span className="sin-stock">
                                          SIN STOCK
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })
                      ) : (
                        /* Si hay categoría seleccionada, mostrar como antes */
                        <div className="catalogo-grid">
                          {productosFiltrados.map(p => (
                            <div
                              key={p.id}
                              className={`product-card ${
                                p.stock === 0
                                  ? 'producto-sin-stock sin-click'
                                  : ''
                              }`}
                              onClick={() => abrirProductoDetalle(p)}
                            >
                              <img
                                src={p.imgSrc}
                                alt={p.nombre}
                                className="img-producto-carrito"
                              />
                              <div className="product-info">
                                <h3>{p.nombre}</h3>
                                <p>{p.descripcion}</p>
                                <h5>${p.precio}</h5>
                              </div>
                              {p.stock === 0 && (
                                <span className="sin-stock">SIN STOCK</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================
              ENTRADAS & EVENTOS
          ======================================================= */}
          <div className="accordion-item">
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${
                  abierto === 'entradas' ? '' : 'collapsed'
                }`}
                onClick={() => {
                  setAbierto(prev => {
                    const nuevo = prev === 'entradas' ? null : 'entradas'
                    // 👉 Si se abre, mostrar eventos por defecto
                    if (nuevo === 'entradas') {
                      setEntradasInterno(prev => prev ?? 'eventos')
                    }

                    return nuevo
                  })
                }}
              >
                🎟️ Entradas & Eventos
              </button>
            </h2>

            {abierto === 'entradas' && (
              <div className="accordion-collapse show">
                <div className="accordion-body d-flex flex-column gap-4">
                  <div className="d-flex justify-content-center gap-1 flex-wrap">
                    {/* EVENTOS */}
                    <button
                      className="botones-entradas btn btn-outline-dark position-relative"
                      onClick={e => {
                        e.stopPropagation()
                        setEntradasInterno(prev =>
                          prev === 'eventos' ? null : 'eventos'
                        )
                      }}
                    >
                      Próximos eventos
                      <span className="badge bg-secondary rounded-pill ms-2">
                        {eventos?.length ?? 0}
                      </span>
                    </button>

                    {/* MIS ENTRADAS */}
                    <button
                      className="botones-entradas btn btn-outline-dark position-relative"
                      onClick={e => {
                        e.stopPropagation()
                        setEntradasInterno(prev =>
                          prev === 'mis' ? null : 'mis'
                        )
                      }}
                    >
                      Mis entradas
                      {contadorMisEntradas > 0 && (
                        <span className="badge bg-danger rounded-pill ms-2">
                          {contadorMisEntradas}
                        </span>
                      )}
                    </button>

                    {/* HISTORIAL */}
                    <button
                      className="botones-entradas btn btn-secondary position-relative"
                      onClick={e => {
                        e.stopPropagation()
                        setEntradasInterno(prev =>
                          prev === 'historial' ? null : 'historial'
                        )
                      }}
                    >
                      Historial
                    </button>
                  </div>

                  {/* EVENTOS */}
                  {entradasInterno === 'eventos' && (
                    <div>
                      <hr />
                      <h6 className="fw-semibold mb-3">Próximos eventos</h6>
                      <EntradasEventos />
                    </div>
                  )}

                  {/* MIS ENTRADAS */}
                  {entradasInterno === 'mis' && (
                    <div>
                      <hr />
                      <h6 className="fw-semibold mb-3">Mis entradas</h6>
                      <MisEntradas />
                    </div>
                  )}

                  {/* HISTORIAL */}
                  {entradasInterno === 'historial' && (
                    <div className="bg-light p-3 rounded">
                      {!user && !loading && (
                        <p className="text-center text-danger mt-3">
                          Debés iniciar sesión para ver tu historial de
                          entradas.
                        </p>
                      )}

                      {loading && (
                        <p className="text-muted text-center">
                          Cargando historial...
                        </p>
                      )}

                      {user && (
                        <>
                          <hr />
                          <h6 className="fw-semibold mb-3">
                            Historial de entradas usadas o expiradas
                          </h6>
                          <HistorialEntradas />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================
              REDES SOCIALES
          ======================================================= */}
          <div className="accordion-item">
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${
                  abierto === 'redes' ? '' : 'collapsed'
                }`}
                onClick={() => toggle('redes')}
              >
                📞 Redes Sociales
              </button>
            </h2>

            {abierto === 'redes' && (
              <div className="accordion-collapse show">
                <div className="accordion-body">
                  <RedesSociales />
                </div>
              </div>
            )}
          </div>

          {/* ======================================================
          UBICACIÓN
          ====================================================== */}
          <div className="accordion-item">
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${
                  abierto === 'ubicacion' ? '' : 'collapsed'
                }`}
                onClick={() => {
                  toggle('ubicacion')
                  setMostrarMapa(false)
                }}
              >
                📍 Ubicación
              </button>
            </h2>

            {abierto === 'ubicacion' && (
              <div className="accordion-collapse show">
                <div className="accordion-body d-grid gap-2">
                  {!ubicacionCargada && (
                    <p className="text-muted text-center">
                      Cargando ubicación...
                    </p>
                  )}

                  {ubicacionCargada && !ubicacion.mapsEmbedUrl && (
                    <p className="text-muted text-center">
                      Ubicación no configurada.
                    </p>
                  )}

                  {ubicacionCargada && ubicacion.mapsEmbedUrl && (
                    <>
                      <button
                        className="btn ubicacion-btn btn-outline-dark mb-2"
                        onClick={() => setMostrarMapa(prev => !prev)}
                      >
                        {mostrarMapa ? 'Ocultar mapa' : 'Ver mapa'}
                      </button>

                      {mostrarMapa && (
                        <div className="ubicacion-mapa">
                          <iframe
                            src={ubicacion.mapsEmbedUrl}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {ubicacion.mapsLink && (
                        <a
                          href={ubicacion.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-secondary mt-2"
                        >
                          Abrir en Google Maps
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================
              LOGIN / USUARIO
          ======================================================= */}
          <div className="accordion-item">
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${
                  abierto === 'usuario' ? '' : 'collapsed'
                }`}
                onClick={() => {
                  toggle('usuario')
                  setMostrarTelefono(false)
                  setSmsEnviado(false)
                  setSmsError(false)
                }}
              >
                👤 Login / Usuario
              </button>
            </h2>
            {abierto === 'usuario' && (
              <div className="accordion-collapse show">
                <div className="accordion-body text-center">
                  {/* ⏳ ESPERANDO FIREBASE */}
                  {loading && (
                    <p className="text-muted text-center">
                      Verificando sesión...
                    </p>
                  )}

                  {/* 🔐 LOGIN (cuando NO hay user y terminó loading) */}
                  {!loading && !user && (
                    <>
                      {loginSettings.google && (
                        <button
                          className="google-btn d-block mx-auto mb-2"
                          onClick={() => {
                            setMostrarTelefono(false)
                            setSmsEnviado(false)
                            setSmsError(false)
                            loginGoogle()
                          }}
                        >
                          <img src={googleIcon} alt="Google" />
                          <span>Iniciar sesión con Google</span>
                        </button>
                      )}

                      {loginSettings.facebook && (
                        <button
                          className="facebook-btn-small d-block mx-auto mb-3"
                          onClick={() => {
                            setMostrarTelefono(false)
                            setSmsEnviado(false)
                            setSmsError(false)
                            loginFacebook()
                          }}
                        >
                          <span className="facebook-icon-box">
                            <img src={facebookIcon} alt="Facebook" />
                          </span>
                          Iniciar sesión con Facebook
                        </button>
                      )}

                      <div className="login-divider my-3">
                        <span>o</span>
                      </div>

                      {/* 📧 LOGIN EMAIL LINK */}
                      <button
                        className="btn btn-outline-dark d-block mx-auto mb-2"
                        id="btn-correoelectronico"
                        onClick={async () => {
                          setMostrarTelefono(false)
                          setSmsEnviado(false)
                          setSmsError(false)
                          const res = await swalConfirmWarning({
                            title: 'Ingresá tu correo electrónico',
                            html: `
                            <input
                              id="swal-email-login"
                              class="swal2-input"
                              type="email"
                              placeholder="tuemail@email.com"
                            />
                            <p style="font-size:12px;color:#777">
                              Te enviaremos un enlace para iniciar sesión.
                            </p>
                          `,
                            confirmText: 'Enviar enlace',
                            cancelText: 'Cancelar',
                            width: 380,
                          })

                          if (!res.isConfirmed) return

                          const email = document
                            .getElementById('swal-email-login')
                            ?.value.trim()

                          if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                            await swalError({
                              title: 'Email inválido',
                              text: 'Ingresá un correo electrónico válido.',
                            })
                            return
                          }

                          loginEmailEnviarLink(email)
                        }}
                      >
                        Correo electrónico / Contraseña
                      </button>

                      {loginSettings.phone && (
                        <button
                          className="btn btn-outline-dark d-block mx-auto mb-2"
                          id="btn-telefono"
                          onClick={async () => {
                            setMostrarTelefono(prev => !prev)
                            setSmsError(false)
                          }}
                        >
                          Iniciar sesión con Teléfono
                        </button>
                      )}
                    </>
                  )}

                  {/* 📞 LOGIN TELÉFONO */}
                  {!loading && !user && mostrarTelefono && (
                    <section
                      className="auth-telefono-container mt-3 mx-auto p-3 rounded-3 border"
                      style={{ maxWidth: 360 }}
                    >
                      <h6 className="fw-semibold mb-3 text-center">
                        Verificación por teléfono
                      </h6>
                      <div className="d-grid gap-2">
                        <input
                          id="phoneInput"
                          type="text"
                          className="form-control"
                          placeholder="+5491123456789"
                        />

                        <button
                          className="btn btn-outline-dark"
                          onClick={async () => {
                            const ok = await loginTelefonoEnviarCodigo(
                              document.getElementById('phoneInput').value
                            )

                            if (ok == true) setSmsEnviado(true)
                            else if (ok != 'inexistente') setSmsError(true)
                          }}
                        >
                          Enviar código SMS
                        </button>

                        {smsEnviado && (
                          <>
                            <input
                              id="codeInput"
                              type="text"
                              className="form-control"
                              placeholder="Código recibido"
                            />

                            <button
                              className="btn btn-outline-dark"
                              onClick={() =>
                                loginTelefonoValidarCodigo(
                                  document.getElementById('codeInput').value
                                )
                              }
                            >
                              Validar código
                            </button>
                          </>
                        )}
                      </div>
                      {!smsError && (
                        <p
                          className="small text-warning text-center mb-0"
                          style={{ fontSize: '11px' }}
                        >
                          ⚠️ En algunos celulares el SMS puede demorar o no
                          llegar.
                          <br />
                          Recomendamos usar correo electrónico o Google.
                        </p>
                      )}

                      {smsError && (
                        <p
                          className="small text-danger text-center mb-0"
                          style={{ fontSize: '11px' }}
                        >
                          ¡Atención! No se pudo enviar el SMS a este número.
                          <br />
                          Por favor, prueba iniciar sesión con otro metodo.
                        </p>
                      )}
                      <p className="recaptcha-legal">
                        Este sitio está protegido por reCAPTCHA y se aplican la{' '}
                        <a
                          href="https://policies.google.com/privacy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Política de Privacidad
                        </a>{' '}
                        y los{' '}
                        <a
                          href="https://policies.google.com/terms"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Términos del Servicio
                        </a>{' '}
                        de Google.
                      </p>
                    </section>
                  )}

                  {/* 👤 USUARIO LOGUEADO */}
                  {(user?.nombre || user?.displayName) && (
                    <div className="d-flex flex-column align-items-center gap-1">
                      {/* 👋 SALUDO + EDITAR */}
                      <p className="fw-bold fs-5 mb-0 d-flex align-items-center gap-2">
                        Hola, {user.nombre || user.displayName}
                        {puedeEditarPerfil(user) && (
                          <span
                            role="button"
                            title="Editar nombre y email"
                            style={{ cursor: 'pointer', fontSize: '0.9em' }}
                            onClick={async () => {
                              const { editarPerfilUsuario } = await import(
                                '../../services/perfilUsuario.js'
                              )

                              const res = await editarPerfilUsuario({
                                uid: user.uid,
                                nombreActual: user.nombre || user.displayName,
                                emailActual: user.email || '',
                                telefono: user.phoneNumber || '',
                              })

                              if (res) {
                                window.dispatchEvent(
                                  new Event('perfil-actualizado')
                                )
                              }
                            }}
                          >
                            ✏️
                          </span>
                        )}
                      </p>

                      {/* 📧 EMAIL */}
                      {user.email && (
                        <p className="text-muted small mb-0">{user.email}</p>
                      )}

                      {/* 📞 TELÉFONO */}
                      {user.phoneNumber && (
                        <p className="text-muted small mb-1">
                          {user.phoneNumber}
                        </p>
                      )}

                      {/* 🚪 CERRAR SESIÓN */}
                      <button
                        className="btn btn-outline-dark btn-sm mt-2"
                        onClick={logout}
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                  <div id="recaptcha-container"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
