import { useEffect } from 'react'
import { useFirebase } from '../../context/FirebaseContext'
import { useEntradas } from '../../context/EntradasContext'
import { generarEntradaQr } from '../../services/generarQr'

export default function MisEntradas() {
  const { user } = useFirebase()
  const { misEntradas, cargarMisEntradas } = useEntradas()

  useEffect(() => {
    if (user) cargarMisEntradas(user.uid)
  }, [user])

  if (!user)
    return <p className="text-center mt-3">Iniciá sesión para ver entradas.</p>

  return (
    <div className="mis-entradas">
      <h4>Mis Entradas</h4>

      {misEntradas.length === 0 && <p>No tenés entradas activas.</p>}

      {misEntradas.map(e => (
        <div key={e.id} className="entrada-card">
          <p>
            <b>{e.nombreEvento}</b>
          </p>
          <p>{e.fecha}</p>
          <p>{e.lugar}</p>

          <button
            className="btn-verqr"
            onClick={() =>
              generarEntradaQr({
                ticketId: e.id,
                nombreEvento: e.nombreEvento,
                fecha: e.fecha,
                lugar: e.lugar,
                usuario: user.displayName,
              })
            }
          >
            Ver QR
          </button>
        </div>
      ))}
    </div>
  )
}
