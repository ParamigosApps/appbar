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
} // =====================================================
// REQUIERE INICIAR SESION
// =====================================================

export async function swalRequiereLogin() {
  return Swal.fire({
    title: 'Debes iniciar sesión',
    text: 'Inicia sesión para comprar.',
    icon: 'warning',
    confirmButtonText: 'Iniciar sesión',
    allowOutsideClick: false,
    allowEscapeKey: true,
    customClass: {
      popup: 'swal-popup-custom',
      confirmButton: 'swal-btn-confirm',
    },
    buttonsStyling: false,
  })
}
// =====================================================
// ✏️ FORM PERFIL USUARIO (NOMBRE + EMAIL + TELÉFONO)
// =====================================================
export function swalEditarPerfil({
  nombreActual = '',
  emailActual = '',
  telefono = '',
}) {
  return Swal.fire({
    title: '✏️ Editar perfil',
    html: `
      <input
        id="swal-nombre"
        class="swal2-input"
        placeholder="Nombre y apellido"
        value="${nombreActual}"
      />

      <input
        id="swal-email"
        class="swal2-input"
        placeholder="Email (opcional)"
        value="${emailActual || ''}"
      />

      ${
        telefono
          ? `
            <input
              class="swal2-input"
              value="${telefono}"
              disabled
            />
        <p className="text-muted small fst-italic">
          El teléfono no puede modificarse
        </p>

          `
          : ''
      }

      <p style="font-size:12px;color:#777">
        Tus entradas estaran disponibles en la app y en el email en caso de ingresarlo..
      </p>
    `,

    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',

    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-dark',
    },

    buttonsStyling: false,
    focusConfirm: false,

    preConfirm: () => {
      const nombre = document.getElementById('swal-nombre').value.trim()
      const email = document.getElementById('swal-email').value.trim()

      if (!nombre || nombre.length < 2) {
        Swal.showValidationMessage('Ingresá un nombre válido')
        return false
      }

      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        Swal.showValidationMessage('Email inválido')
        return false
      }

      return {
        nombre,
        email: email || null,
      }
    },
  })
}

export function swalEventosNoVigentes({ eventos = [] }) {
  return Swal.fire({
    title: 'Sin eventos activos',
    html: `
      <p style="font-size:14px;color:#555;margin-bottom:12px;margin-top:4px">
        En este momento no hay ningun evento vigente.
      </p>

      ${
        eventos.length
          ? `
        <div style="text-align:left;font-size:14px">
          <strong>Próximos eventos:</strong>
          <ul style="padding-left:18px;margin-top:8px">
            ${eventos
              .map(ev => `<li style="margin-bottom:4px">${ev}</li>`)
              .join('')}
          </ul>
        </div>
      `
          : `<p style="font-size:13px;color:#777">No hay eventos programados.</p>`
      }
    `,
    icon: 'info',
    confirmButtonText: 'Entendido',
    customClass: {
      popup: 'swal-popup-custom',
      confirmButton: 'swal-btn-confirm',
    },
    buttonsStyling: false,
  })
}
