// src/services/loadingService.js
import Swal from 'sweetalert2'

export function showLoading(text = 'Procesando...') {
  Swal.fire({
    title: text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading()
    },
  })
}

export function hideLoading() {
  Swal.close()
}
