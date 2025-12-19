import { useState } from 'react'
import { useFirebase } from '../../context/FirebaseContext'

export default function LoginSection() {
  const { user, loginGoogle, loginFacebook, loginTelefono, logout } =
    useFirebase()

  const [telefono, setTelefono] = useState('')
  const [codigo, setCodigo] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)

  // Enviar SMS
  async function enviarCodigo() {
    try {
      const res = await loginTelefono(telefono)
      setConfirmacion(res)
      alert('Código enviado ✔')
    } catch (e) {
      alert('Error enviando SMS: ' + e.message)
    }
  }

  // Validar SMS
  async function validarCodigo() {
    try {
      await confirmacion.confirm(codigo)
      alert('Teléfono validado ✔')
    } catch (e) {
      alert('Código incorrecto')
    }
  }

  // --------------------------
  // Usuario LOGUEADO
  // --------------------------
  if (user) {
    return (
      <div className="text-center">
        <p className="fw-bold mb-2">Hola, {user.displayName || 'Usuario'}</p>

        {user.phoneNumber && <p className="text-muted">{user.phoneNumber}</p>}

        <button className="google-btn logout mx-auto mt-2" onClick={logout}>
          <img src="/Assets/img/google.png" />
          Cerrar sesión
        </button>
      </div>
    )
  }

  // --------------------------
  // Usuario NO LOGUEADO
  // --------------------------
  return (
    <div className="text-center">
      {/* GOOGLE */}
      <button className="google-btn mx-auto mb-2" onClick={loginGoogle}>
        <img src="/Assets/img/google.png" alt="Google" />
        <span>Iniciar sesión con Google</span>
      </button>

      {/* FACEBOOK */}
      <button
        className="facebook-btn-small mx-auto mb-3"
        onClick={loginFacebook}
      >
        <span className="facebook-icon-box">
          <svg viewBox="0 0 36 36">
            <path
              fill="#1877F2"
              d="M36 18a18 18 0 1 0-20.8 17.8V23.3h-5.2v-5.3h5.2v-4c0-5.1 3-7.9 7.6-7.9 2.2 0 4.5.4 4.5.4v5h-2.5c-2.5 0-3.2 1.6-3.2 3.3v3.3h5.4l-.9 5.3h-4.5v12.5A18 18 0 0 0 36 18"
            />
            <path
              fill="#fff"
              d="M25.2 23.3l.9-5.3h-5.4v-3.3c0-1.7.7-3.3 3.2-3.3h2.5v-5s-2.3-.4-4.5-.4c-4.6 0-7.6 2.8-7.6 7.9v4h-5.2v5.3h5.2v12.5c1.1.1 2.3.2 3.5.2s2.4-.1 3.5-.2V23.3h4.5"
            />
          </svg>
        </span>
        Iniciar sesión con Facebook
      </button>

      {/* DIVIDER */}
      <div className="login-divider">
        <span>o</span>
      </div>

      {/* TELEFONO */}
      <div className="telefono-row">
        {!confirmacion ? (
          <>
            <input
              type="text"
              placeholder="+5491123456789"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />

            <button
              className="btnTelefonoLogin btn btn-outline-dark"
              onClick={enviarCodigo}
            >
              Enviar código
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Código SMS"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
            />

            <button
              className="btnTelefonoLogin btn btn-outline-dark"
              onClick={validarCodigo}
            >
              Validar
            </button>
          </>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  )
}
