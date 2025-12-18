// --------------------------------------------------------------
// src/components/home/MenuAcordeon.jsx — VERSIÓN FINAL 2025
// --------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { useCatalogo } from '../../context/CatalogoContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEntradas } from '../../context/EntradasContext.jsx'

import EntradasEventos from '../entradas/EntradasEventos.jsx'
import MisEntradas from '../entradas/MisEntradas.jsx'
import RedesSociales from '../home/RedesSociales.jsx'

// Íconos
import googleIcon from '../../assets/img/google.png'
import facebookIcon from '../../assets/img/facebook.png'

import { db } from '../../Firebase.js'
import { doc, getDoc } from 'firebase/firestore'

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

  const toggle = key => setAbierto(prev => (prev === key ? null : key))

  // ------------------------------------------------------------
  // CONTEXTOS
  // ------------------------------------------------------------
  const {
    categorias,
    categoriaActiva,
    seleccionarCategoria,
    toggleCatalogo,
    productosFiltrados,
    catalogoVisible,
    abrirProductoDetalle,
  } = useCatalogo()

  const { eventos, historialEntradas, misEntradas } = useEntradas()

  const {
    user,
    loginSettings,
    loginGoogle,
    loginFacebook,
    loginTelefonoEnviarCodigo,
    loginTelefonoValidarCodigo,
    logout,
    loading,
  } = useAuth()

  const contadorMisEntradas = misEntradas?.length ?? 0

  // ------------------------------------------------------------
  // Evento global para abrir login
  // ------------------------------------------------------------
  useEffect(() => {
    const handler = () => toggle('usuario')
    document.addEventListener('abrir-login', handler)
    return () => document.removeEventListener('abrir-login', handler)
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

  const [confirmacionTelefono, setConfirmacionTelefono] = useState(null)
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
                onClick={() => toggle('catalogo')}
              >
                🍾 Catálogo
              </button>
            </h2>

            {abierto === 'catalogo' && (
              <div className="accordion-collapse show">
                <div className="accordion-body d-grid gap-3">
                  <button
                    className="btn btn-outline-dark w-100"
                    onClick={() => {
                      seleccionarCategoria('Todos')
                      toggleCatalogo()
                    }}
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
                            onClick={() => seleccionarCategoria(cat)}
                          >
                            <span className="categoria-icon">{icon}</span>
                            <span className="categoria-label">{cat}</span>
                          </button>
                        )
                      })}
                  </div>

                  <div className="text-start mt-3 mb-2 text-muted">
                    {categoriaActiva === 'Todos' ? (
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
                  toggle('entradas')
                  setEntradasInterno(null)
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
                      <h6 className="fw-bold mb-2">
                        Historial de entradas usadas
                      </h6>
                      {!user && !loading && (
                        <p className="text-center text-danger mt-3">
                          Debés iniciar sesión para ver tu historial de
                          entradas.
                        </p>
                      )}
                      {loading && (
                        <p className="text-muted text-center">
                          Verificando sesión...
                        </p>
                      )}

                      {user && historialEntradas?.length === 0 && (
                        <p className="text-muted m-0">
                          Aún no tienes historial.
                        </p>
                      )}

                      {user && historialEntradas?.length > 0 && (
                        <ul className="m-0 ps-3">
                          {historialEntradas.map(h => (
                            <li key={h.id} className="text-muted">
                              {h.nombreEvento} — {h.fechaUso}
                            </li>
                          ))}
                        </ul>
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
                }}
              >
                👤 Login / Usuario
              </button>
            </h2>

            {abierto === 'usuario' && (
              <div className="accordion-collapse show">
                <div className="accordion-body text-center">
                  {!user && (
                    <>
                      {loginSettings.google && (
                        <button
                          className="google-btn d-block mx-auto mb-2"
                          onClick={loginGoogle}
                        >
                          <img src={googleIcon} alt="Google" />
                          <span>Iniciar sesión con Google</span>
                        </button>
                      )}

                      {loginSettings.facebook && (
                        <button
                          className="facebook-btn-small d-block mx-auto mb-3"
                          onClick={loginFacebook}
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

                      {loginSettings.phone && (
                        <button
                          className="btn btn-outline-dark"
                          onClick={() => setMostrarTelefono(prev => !prev)}
                        >
                          Iniciar sesión con Teléfono
                        </button>
                      )}
                    </>
                  )}

                  {user && (
                    <div>
                      <p className="fw-bold fs-5">
                        Hola, {user.displayName || user.phoneNumber}
                      </p>

                      <button
                        className="google-btn logout mx-auto"
                        onClick={logout}
                      >
                        <img src={googleIcon} alt="logout" />
                        Cerrar sesión
                      </button>
                    </div>
                  )}

                  {mostrarTelefono && (
                    <section className="auth-telefono-container mt-3 telefono-row mx-auto">
                      <input
                        id="phoneInput"
                        type="text"
                        placeholder="+5491123456789"
                      />

                      <button
                        className="btn btn-outline-dark"
                        onClick={() =>
                          loginTelefonoEnviarCodigo(
                            document.getElementById('phoneInput').value
                          )
                        }
                      >
                        Enviar código
                      </button>

                      <input
                        id="codeInput"
                        type="text"
                        placeholder="Código SMS"
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

                      <div id="recaptcha-container"></div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
