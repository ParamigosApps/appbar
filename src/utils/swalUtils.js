import Swal from 'sweetalert2'

export function swalSuccess({
  title = 'Operación exitosa',
  text = '',
  confirmText = 'Aceptar',
  timer = 2500,
}) {
  return Swal.fire({
    title,
    text,
    icon: 'success',

    confirmButtonText: confirmText,

    timer,
    timerProgressBar: true,

    customClass: {
      confirmButton: 'swal-btn-confirm',
    },

    buttonsStyling: false,
  })
}

export function swalError({
  title = 'Error',
  text = '',
  confirmText = 'Aceptar',
  timer = 3000,
}) {
  return Swal.fire({
    title,
    text,
    icon: 'error',

    confirmButtonText: confirmText,

    timer,
    timerProgressBar: true,

    customClass: {
      confirmButton: 'swal-btn-confirm',
    },

    buttonsStyling: false,
  })
}
