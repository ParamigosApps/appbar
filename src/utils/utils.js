// --------------------------------------------------------------
// src/utils/utils.js
// --------------------------------------------------------------
import Toastify from 'toastify-js'
import 'toastify-js/src/toastify.css'
// Formatea una fecha a: "23/11/2025, 07:35HS"
export function formatearFecha(fecha = new Date()) {
  try {
    const d = fecha instanceof Date ? fecha : new Date(fecha)

    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const año = d.getFullYear()

    const horas = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')

    return `${dia}/${mes}/${año}, ${horas}:${mins}HS`
  } catch (e) {
    console.error('Error formatearFecha:', e)
    return 'Fecha inválida'
  }
}
export function formatearSoloFecha(valor) {
  if (!valor) return '—'

  let fecha = null

  // 1️⃣ Firestore Timestamp
  if (typeof valor?.toDate === 'function') {
    fecha = valor.toDate()

    // 2️⃣ Date nativo
  } else if (valor instanceof Date) {
    fecha = valor

    // 3️⃣ Número (timestamp en ms)
  } else if (typeof valor === 'number') {
    fecha = new Date(valor)

    // 4️⃣ String (ISO, yyyy-mm-dd, timestamp string)
  } else if (typeof valor === 'string') {
    const num = Number(valor)
    fecha = !isNaN(num) ? new Date(num) : new Date(valor)
  }

  // ❌ Fecha inválida
  if (!fecha || isNaN(fecha.getTime())) return '—'

  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const año = fecha.getFullYear()

  return `${dia}/${mes}/${año}`
}

// Fecha exacta de compra
export function obtenerFechaCompra() {
  return formatearFecha(new Date())
}

// Mostrar mensaje en pantalla
export function mostrarMensaje(texto) {
  Toastify({
    text: `${texto}`,
    duration: 1700,
    gravity: 'top',
    position: 'center',
    close: false,
    style: {
      background: '#e81414e3', // 🔥 rojo oscuro
      color: 'white',
      width: '90%',
      textAlign: 'center',
      borderRadius: '10px',
      fontWeight: '700',
      fontSize: '15px',
    },
  }).showToast()
}

export function abrirLoginGlobal() {
  document.dispatchEvent(new CustomEvent('abrir-login', { detail: 'forced' }))
}
