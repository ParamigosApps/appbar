import Swal from 'sweetalert2'
import { formatearSoloFecha } from './utils'

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

// =====================================================
// 📧 LOGIN POR EMAIL
// =====================================================
export function swalLoginEmail({
  title = 'Ingresá tu correo electrónico',
  confirmText = 'Enviar enlace',
  cancelText = 'Cancelar',
  width = 380,
} = {}) {
  return Swal.fire({
    title,
    html: `
      <input
        id="swal-email-login"
        class="swal2-input"
        type="email"
        placeholder="tuemail@email.com"
        autocomplete="email"
      />
      <p style="font-size:12px;color:#777">
        Te enviaremos un enlace para iniciar sesión.
      </p>
    `,
    width,

    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,

    buttonsStyling: false,
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-dark',
    },

    focusConfirm: false,

    preConfirm: () => {
      const email = document.getElementById('swal-email-login')?.value?.trim()

      if (!email) {
        Swal.showValidationMessage('Ingresá tu email')
        return false
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        Swal.showValidationMessage('Email inválido')
        return false
      }

      return email
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

export function mostrarResultadoEntradasGratis({
  evento,
  exitosas = [],
  fallidas = [],
  onConfirm,
}) {
  // ==========================================================
  // ✅ AGRUPAR EXITOSAS POR LOTE
  // ==========================================================
  const okAgrupadas = {}

  exitosas.forEach(e => {
    const lote = e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada general'

    if (!okAgrupadas[lote]) {
      okAgrupadas[lote] = {
        lote,
        solicitadas: 0,
        generadas: 0,
      }
    }

    okAgrupadas[lote].solicitadas += Number(e.cantidad || 0)
    okAgrupadas[lote].generadas += Number(e.cantidad || 0)
  })

  const okHtml = Object.entries(okAgrupadas)
    .map(
      ([nombre, cant]) => `
    <div class="swal-row ok">
      <div class="swal-row-title">${nombre}</div>
      <div class="swal-row-value">x${cant}</div>
    </div>
  `
    )
    .join('')

  // ==========================================================
  // ❌ AGRUPAR FALLIDAS POR LOTE + CUPO
  // ==========================================================
  const errAgrupadas = {}

  fallidas.forEach(e => {
    const lote = e.lote?.nombre || e.loteNombre || e.nombre || 'Entrada general'

    if (!errAgrupadas[lote]) {
      errAgrupadas[lote] = {
        lote,
        solicitadas: 0,
        maxPorUsuario: e.maxPorUsuario ?? null,
        usadas: Number(e.usadasPorUsuario || 0),
        pendientes: Number(e.pendientesPorUsuario || 0),
        motivo: e.error || 'No se pudo generar la entrada',
      }
    }

    errAgrupadas[lote].solicitadas += Number(e.cantidad || 0)
  })
  const errHtml = Object.values(errAgrupadas)
    .map(e => {
      let detalle = ''

      if (Number.isFinite(e.maxPorUsuario)) {
        const disponibles = e.maxPorUsuario - e.usadas - e.pendientes

        if (disponibles > 0) {
          detalle = `
          Tenés ${e.usadas} ·
          Solicitaste ${e.solicitadas} ·
          Podés solicitar hasta ${disponibles}
        `
        } else {
          detalle = `
          Ya alcanzaste el máximo permitido (${e.maxPorUsuario})
        `
        }
      }

      return `
      <div class="swal-row error">
        <div class="swal-row-title">${e.lote}</div>
        <div class="swal-row-sub">
          ${e.motivo}
          ${detalle ? `<div class="swal-row-hint">${detalle}</div>` : ''}
        </div>
      </div>
    `
    })
    .join('')

  // ==========================================================
  // 🎨 HTML FINAL
  // ==========================================================
  const html = `
    <div class="swal-event-header">
  <h2>🎟 ${evento?.nombre || 'Evento'}</h2>
  ${
    evento?.fechaInicio
      ? `<small>${formatearSoloFecha(evento.fechaInicio)}</small>`
      : ''
  }
</div>

${
  okHtml
    ? `<div class="swal-block">
      <h4 class="swal-block-title success">Entradas confirmadas</h4>
      ${okHtml}
    </div>`
    : ''
}

${
  errHtml
    ? `<div class="swal-block">
      <h4 class="swal-block-title error">Entradas no generadas</h4>
      ${errHtml}
    </div>`
    : ''
}
  `

  // ==========================================================
  // 🔔 SWAL FINAL
  // ==========================================================
  return Swal.fire({
    icon: fallidas.length > 0 ? 'warning' : 'success',
    title: 'Resultado de tu solicitud',
    html,
    showCancelButton: true,
    confirmButtonText: 'Ir a mis entradas',
    cancelButtonText: 'Cerrar',
    buttonsStyling: false,
    reverseButtons: true,
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel',
    },
  }).then(res => {
    if (res.isConfirmed && typeof onConfirm === 'function') {
      onConfirm()
    }
  })
}
