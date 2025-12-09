// --------------------------------------------------------------
// ValidacionResultado.jsx — muestra bonito el resultado
// --------------------------------------------------------------
export default function ValidacionResultado({ data }) {
  if (!data) return null

  return (
    <div className="p-3 border rounded bg-light">
      <h5 className="fw-bold mb-2">
        {data.tipo === 'entrada' ? 'Entrada' : 'Compra'} —{' '}
        {data.valido ? '✔ VÁLIDA' : '❌ INVÁLIDA'}
      </h5>

      <p className="mb-1">
        <strong>Mensaje:</strong> {data.mensaje}
      </p>

      {data.data && (
        <pre
          className="mt-2 p-2 bg-dark text-success rounded"
          style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}
        >
          {JSON.stringify(data.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
