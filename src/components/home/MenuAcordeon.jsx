// --------------------------------------------------------------
// src/components/home/MenuAcordeon.jsx (React FIXED VERSION FINAL)
// --------------------------------------------------------------

import React, { useState } from 'react'
import { useCatalogo } from '../../context/CatalogoContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useEntradas } from '../../context/EntradasContext.jsx'

// Componentes
import EntradasEventos from '../entradas/EntradasEventos.jsx'
import MisEntradas from '../entradas/MisEntradas.jsx'
import RedesSociales from '../home/RedesSociales.jsx'

// Íconos
import googleIcon from '../../assets/img/google.png'
import facebookIcon from '../../assets/img/facebook.png'

const iconosCategorias = {
  tragos: '🍹',
  botellas: '🍾',
  combos: '🎉',
  promos: '🏷️',
  accesorios: '🧋',
}

const obtenerIcono = cat => iconosCategorias[cat] || ''

const normalizar = str => String(str).toLowerCase()

export default function MenuAcordeon() {
  // ============================================================
  // ESTADOS PRINCIPALES
  // ============================================================
  const [abierto, setAbierto] = useState(null)
  const [entradasInterno, setEntradasInterno] = useState(null)
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [mostrarTelefono, setMostrarTelefono] = useState(false)

  const toggle = key => setAbierto(prev => (prev === key ? null : key))

  // ============================================================
  // CONTEXTOS
  // ============================================================
  const {
    categorias,
    categoriaActiva,
    seleccionarCategoria,
    toggleCatalogo,
    productosFiltrados,
    catalogoVisible,
    abrirProductoDetalle,
  } = useCatalogo()

  const { entradasPendientes, eventos, historial, misEntradas } = useEntradas()
  const {
    user,
    loginSettings,
    loginGoogle,
    loginFacebook,
    loginTelefonoEnviarCodigo,
    loginTelefonoValidarCodigo,
    logout,
  } = useAuth()

  // Contador de entradas pendientes
  const contadorPendientes = entradasPendientes?.length ?? 0
  const contadorMisEntradas = misEntradas?.length ?? 0

  // ABRIR LOGIN GLOBAL
  React.useEffect(() => {
    const handler = () => toggle('usuario')
    document.addEventListener('abrir-login', handler)
    return () => document.removeEventListener('abrir-login', handler)
  }, [])

  // ============================================================
  // RENDER
  // ============================================================
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
                      seleccionarCategoria('Todos') // 🔥 Resetea las categorías
                      toggleCatalogo() // 🔥 Abre el catálogo completo
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
                    <div className="container my-2">
                      {(productosFiltrados ?? []).map(p => (
                        <div
                          key={p.id}
                          className={`product-card ${
                            p.stock === 0 ? 'producto-sin-stock sin-click' : ''
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

                      {!user && (
                        <p className="text-center text-danger mt-3">
                          Debes iniciar sesión para ver tu historial.
                        </p>
                      )}

                      {user && historial?.length === 0 && (
                        <p className="text-muted m-0">
                          Aún no tienes historial.
                        </p>
                      )}

                      {user && historial?.length > 0 && (
                        <ul className="m-0 ps-3">
                          {historial.map(h => (
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
          ======================================================= */}
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
                  <button
                    className="btn btn-outline-dark"
                    onClick={() => setMostrarMapa(prev => !prev)}
                  >
                    Ver mapa
                  </button>

                  {mostrarMapa && (
                    <div className="mt-2">
                      <iframe
                        className="rounded"
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3282.022302640099!2d-58.3816022!3d-34.6037037!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4aa9f0a6da5edb%3A0x11bead4e234e558b!2sObelisco+de+Buenos+Aires!5e0!3m2!1ses!2sar!4v1699999999999"
                        width="380"
                        height="300"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                      ></iframe>
                    </div>
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
                          className="facebook-btn-small mb-3"
                          onClick={loginFacebook}
                        >
                          <span className="facebook-icon-box">
                            <img
                              src={facebookIcon}
                              alt="Facebook"
                              style={{ width: 32, height: 32 }}
                            />
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
