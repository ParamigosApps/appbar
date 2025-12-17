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

// =====================================================
// 🔴 CONFIRM DANGER (RECHAZAR)
// =====================================================
export function swalConfirmDanger({
  title = '¿Confirmar acción?',
  html = '',
  confirmText = 'Rechazar',
  cancelText = 'Cancelar',
  width = 520,
}) {
  return Swal.fire({
    title,
    html,
    icon: 'warning',
    width,

    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,

    customClass: {
      confirmButton: 'swal-btn-danger',
      cancelButton: 'swal-btn-dark',
    },

    buttonsStyling: false,
  })
}

// =====================================================
// 🟡 CONFIRM WARNING (OPCIONAL / FUTURO)
// =====================================================
export function swalConfirmWarning({
  title = '¿Confirmar?',
  html = '',
  confirmText = 'Continuar',
  cancelText = 'Cancelar',
  width = 520,
}) {
  return Swal.fire({
    title,
    html,
    icon: 'question',
    width,

    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,

    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-dark',
    },

    buttonsStyling: false,
  })
}
