// --------------------------------------------------------------
// src/services/entradasSwal.js — ULTRA PRO BOLICHE v3 (CORREGIDO)
// --------------------------------------------------------------

import Swal from 'sweetalert2'

/**
 * FACTORY — CREA UN SWAL CON THEME DINÁMICO
 * Mantiene compatibilidad total con React y Context (sin hooks).
 */
function crearSwalConTheme(theme = 'light') {
  document.body.classList.remove('light', 'dark')
  document.body.classList.add(theme)

  return Swal.mixin({
    customClass: {
      popup: 'swal-popup-custom boliche-popup',
      confirmButton: 'swal-btn-confirm boliche-btn',
      cancelButton: 'swal-btn-cancel boliche-btn-cancel',
    },
    buttonsStyling: false,
    heightAuto: false,
  })
}

// ======================================================================
// █▀█ █▀█ █░░ █ ▀█▀ █▀▀   SELECCIÓN DE LOTE — (REESTRUCTURADO)
// ======================================================================
export async function abrirSeleccionLote(evento, lotes, theme = 'light') {
  const MySwal = crearSwalConTheme(theme)

  return await MySwal.fire({
    title: `<span class="boliche-titulo">${evento.nombre}</span>`,

    html: `
      <div class="boliche-lotes-scroll">
        ${lotes
          .map(l => {
            const porc =
              l.cantidad > 0 ? Math.round((l.restantes / l.cantidad) * 100) : 0

            return `
              <div class="boliche-card" data-id="${l.id ?? l.index}">

                ${
                  l.imagen
                    ? `<img src="${l.imagen}" class="boliche-img" />`
                    : `<div class="boliche-img placeholder"></div>`
                }

                <div class="boliche-info">

                  <div class="boliche-header">
                    <span class="boliche-nombre">${l.nombre}</span>
                    <span class="boliche-precio">$${l.precio}</span>
                  </div>

                  ${
                    l.genero
                      ? `<span class="boliche-tag">${l.genero.toUpperCase()}</span>`
                      : ''
                  }

                  ${
                    l.descripcion
                      ? `<p class="boliche-desc">${l.descripcion}</p>`
                      : ''
                  }

                  ${
                    l.desdeHora
                      ? `<p class="boliche-extra"><b>Desde:</b> ${l.desdeHora}</p>`
                      : ''
                  }

                  ${
                    l.hastaHora
                      ? `<p class="boliche-extra"><b>Hasta:</b> ${l.hastaHora}</p>`
                      : ''
                  }

                  ${
                    evento.fecha
                      ? `<p class="boliche-extra"><b>Fecha:</b> ${evento.fecha}</p>`
                      : ''
                  }

                  <div class="boliche-bar">
                    <div class="boliche-bar-fill" style="width:${porc}%"></div>
                  </div>

                  <p class="boliche-restantes">
                    Quedan <b>${l.restantes}</b> de <b>${l.cantidad}</b>
                  </p>

                </div>
              </div>
            `
          })
          .join('')}
      </div>
    `,

    showCancelButton: true,
    showConfirmButton: false,
    cancelButtonText: 'Cerrar',

    didOpen: () => {
      document.querySelectorAll('.boliche-card').forEach(card => {
        card.addEventListener('click', () => {
          window._swalValue = card.dataset.id
          Swal.close()
        })
      })
    },
  }).then(result => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      return { cancelado: true }
    }
    return window._swalValue
  })
}

// ======================================================================
// █▀▄▀█ █▀▀ ▀█▀ █▀█ █▀▄   MÉTODO DE PAGO — (REESTRUCTURADO)
// ======================================================================
export async function abrirMetodoPago(
  evento,
  lote,
  precio,
  maxCantidad,
  theme = 'light'
) {
  const MySwal = crearSwalConTheme(theme)
  let cantidad = 1

  return await MySwal.fire({
    title: `<span class="boliche-titulo">${evento.nombre}</span>`,

    html: `
  <div class="compra-wrapper">

    <!-- INFO DEL LOTE -->
    <div class="compra-header">
      <div class="compra-titulo">
        <span class="compra-lote">${lote?.nombre || 'Entrada'}</span>
        <span class="compra-precio">$${precio}</span>
      </div>

      <div class="compra-detalles">
        ${evento.fecha ? `<p><b>📅 Fecha:</b> ${evento.fecha}</p>` : ''}
        ${lote?.desdeHora ? `<p><b>⏱️ Desde:</b> ${lote.desdeHora}</p>` : ''}
        ${lote?.hastaHora ? `<p><b>🕓 Hasta:</b> ${lote.hastaHora}</p>` : ''}
        ${
          lote?.genero
            ? `<p><b>👥 Público:</b> ${lote.genero.toUpperCase()}</p>`
            : ''
        }
      </div>
    </div>

    <!-- CANTIDAD -->
    <div class="compra-cantidad-box">
      <button id="menos" class="compra-cant-btn">–</button>
      <input id="cant" value="1" min="1" max="${maxCantidad}" />
      <button id="mas" class="compra-cant-btn">+</button>
    </div>

    <!-- TOTAL -->
    <p id="total" class="compra-total">
      Total: <b>$${precio}</b>
    </p>

    <!-- BOTONES DE MÉTODO -->
    <div class="compra-metodos">
      <button id="mp" class="compra-btn compra-btn-mp">
        💳 Mercado Pago
      </button>

      <button id="transfer" class="compra-btn compra-btn-trans">
        🔄 Transferencia
      </button>
    </div>
  </div>
`,
    showCancelButton: true,
    showConfirmButton: false,
    cancelButtonText: 'Cancelar',

    didOpen: () => {
      const cant = document.getElementById('cant')
      const total = document.getElementById('total')

      const actualizar = () => {
        let v = Number(cant.value)
        if (v < 1) v = 1
        if (v > maxCantidad) v = maxCantidad

        cantidad = v
        cant.value = v
        total.innerHTML = `Total: <b>$${v * precio}</b>`
      }

      document.getElementById('menos').onclick = () => {
        cant.value--
        actualizar()
      }

      document.getElementById('mas').onclick = () => {
        cant.value++
        actualizar()
      }

      cant.oninput = actualizar

      document.getElementById('mp').onclick = () => {
        window._swalValue = { cantidad, metodo: 'mp' }
        Swal.close()
      }

      document.getElementById('transfer').onclick = () => {
        window._swalValue = { cantidad, metodo: 'transfer' }
        Swal.close()
      }
    },
  }).then(result => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      return { cancelado: true }
    }
    return window._swalValue
  })
}
