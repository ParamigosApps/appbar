// src/components/auth/LoginTelefono.jsx
import { useState } from 'react'
import { useFirebase } from '../../context/FirebaseContext.jsx'
import Swal from 'sweetalert2'

export default function LoginTelefono() {
  const { loginTelefono } = useFirebase()
  const [numero, setNumero] = useState('')
  const [codigo, setCodigo] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)

  async function enviarSMS() {
    try {
      const res = await loginTelefono(numero)
      setConfirmacion(res)
      Swal.fire('SMS enviado', 'Revisá tu teléfono', 'success')
    } catch {}
  }

  async function verificarCodigo() {
    try {
      await confirmacion.confirm(codigo)
      Swal.fire('Listo', 'Sesión iniciada', 'success')
    } catch {
      Swal.fire('Error', 'Código incorrecto', 'error')
    }
  }

  return (
    <div className="container py-4">
      <h3>Iniciar sesión con teléfono</h3>

      <input
        className="form-control my-2"
        placeholder="+54 11 1234 5678"
        value={numero}
        onChange={e => setNumero(e.target.value)}
      />

      {!confirmacion ? (
        <button className="btn btn-primary" onClick={enviarSMS}>
          Enviar SMS
        </button>
      ) : (
        <>
          <input
            className="form-control my-2"
            placeholder="Código"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
          />
          <button className="btn btn-success" onClick={verificarCodigo}>
            Verificar
          </button>
        </>
      )}

      <div id="recaptcha-container"></div>
    </div>
  )
}
