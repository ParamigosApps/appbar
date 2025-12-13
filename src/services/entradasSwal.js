// --------------------------------------------------------------
// src/services/entradasSwal.js — PASSLINE PRO 2025 (FINAL CLEAN)
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import { formatearSoloFecha } from '../utils/utils.js'

// ======================================================================
// CREAR THEME
// ======================================================================
function crearSwalConTheme(theme = 'light') {
  document.body.classList.remove('light', 'dark')
  document.body.classList.add(theme)

  return Swal.mixin({
    customClass: {
      popup: 'swal-popup-custom swal-lotes',
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel',
    },
    buttonsStyling: false,
    heightAuto: false,
  })
}

// ======================================================================
// SELECCIÓN DE LOTE
// ======================================================================
export async function abrirSeleccionLote(evento, lotes, theme = 'light') {
  const MySwal = crearSwalConTheme(theme)

  return await MySwal.fire({
    title: `<span class="swal-title-main">${evento.nombre}</span>`,

    html: `
      <div class="lotes-scroll">
        <div class="lotes-wrapper">
${lotes
  .map(l => {
    const agotado = l.restantes <= 0
    const porc =
      l.cantidad > 0 ? Math.round((l.restantes / l.cantidad) * 100) : 0

    const generoClase =
      l.genero?.toLowerCase() === 'mujeres'
        ? 'badge-rose'
        : l.genero?.toLowerCase() === 'hombres'
        ? 'badge-blue'
        : 'badge-unisex'

    const generoBadge = `<span class="lote-badge ${generoClase}">${(
      l.genero || 'UNISEX'
    ).toUpperCase()}</span>`

    const consumicionBadge = l.incluyeConsumicion
      ? `<span class="lote-badge badge-consu-ok">🍸 CON CONSUMICIÓN</span>`
      : `<span class="lote-badge badge-consu-no">SIN CONSUMICIÓN</span>`

    const precioHtml =
      Number(l.precio) === 0
        ? `<span class="precio-valor badge-gratis">GRATIS</span>`
        : `<span class="precio-valor badge-pago">$${l.precio}</span>`

    let badgeStock = ''
    if (!agotado && porc <= 30) {
      badgeStock =
        porc <= 10
          ? `<span class="lote-badge badge-red">ÚLTIMOS CUPOS</span>`
          : `<span class="lote-badge badge-orange">POCOS CUPOS</span>`
    }

    const fechaHtml =
      evento.fecha && formatearSoloFecha ? formatearSoloFecha(evento.fecha) : ''

    return `
<div class="lote-card ${agotado ? 'lote-sin-cupos' : ''}" data-id="${l.index}">
  ${fechaHtml ? `<div class="lote-fecha-top-abs">${fechaHtml}</div>` : ''}

  <div class="lote-nombre-principal">
    <span class="lote-label">Lote:</span> ${String(l.nombre).toUpperCase()}
  </div>

  ${
    l.descripcionLote?.trim()
      ? `<div class="lote-desc"><span class="lote-label">Descripción: </span>${l.descripcionLote}</div>`
      : ''
  }

  <div class="lote-horario-box">
    <span class="lote-label">Ingreso permitido:</span>
    <span class="lote-horario-value">${l.desdeHora || '-'} → ${
      l.hastaHora || '-'
    }</span>
  </div>

  <div class="lote-badges">
  <span class="lote-label">${
    l.genero?.toLowerCase() === 'hombres' ||
    l.genero?.toLowerCase() === 'mujeres'
      ? 'Exclusivo: '
      : 'Género: '
  }</span>
  
    ${generoBadge}
    ${consumicionBadge}
    ${badgeStock}
  </div>

  <div class="lote-costo-box">
    <span class="lote-label">Costo:</span>
    ${precioHtml}
  </div>

  <div class="lote-footer-flex">
    ${
      agotado
        ? `<div class="lote-agotado-btn">AGOTADO</div>`
        : `<div class="lote-select-mini">COMPRAR</div>`
    }
  </div>
</div>
`
  })
  .join('')}
        </div>
      </div>
    `,

    showCancelButton: true,
    cancelButtonText: 'Cerrar',
    showConfirmButton: false,

    didOpen: () => {
      const cards = document.querySelectorAll('.lote-card')
      cards.forEach(card => {
        if (card.classList.contains('lote-sin-cupos')) return

        const btn = card.querySelector('.lote-select-mini')
        if (!btn) return

        btn.onclick = () => {
          window._swalValue = { loteId: card.dataset.id }
          Swal.close()
        }
      })
    },
  }).then(res => {
    if (res.dismiss === Swal.DismissReason.cancel) return { cancelado: true }
    return window._swalValue
  })
}

// ======================================================================
// RESUMEN DE LOTE
// ======================================================================
export async function abrirResumenLote(evento, lote, opciones = {}, theme) {
  const MySwal = crearSwalConTheme(theme)

  const {
    maxCantidad = 99,
    limiteUsuario = 0,
    totalObtenidas = 0,
    totalPendientes = 0,
    cuposLote = 0,
    precioUnitario,
    esGratis: esGratisProp,
  } = opciones

  const precioBase =
    typeof precioUnitario === 'number'
      ? precioUnitario
      : Number(lote?.precio || 0)

  const esGratis = esGratisProp ?? precioBase === 0

  const disponiblesAhora = Math.max(
    0,
    Math.min(limiteUsuario, cuposLote || limiteUsuario, maxCantidad)
  )

  let cantidad = 1
  let metodoSeleccionado = null

  const res = await MySwal.fire({
    title: `<span class="swal-title-main">${evento.nombre.toUpperCase()}</span>`,

    html: `
      <div class="resumen-lote-box">
        <p><b>Lote:</b> ${lote.nombre.toUpperCase()}</p>
        <hr />

        <div class="info-limites-box">
          ${
            totalObtenidas > 0
              ? `
            <div class="limite-row">
              <span class="label">Tus entradas:</span>
              <span class="value infoCantEntradas">${totalObtenidas}</span>
            </div>`
              : ''
          }

          <div class="limite-row">
            <span class="label">Máximo permitido por cuenta:</span>
            <span class="value infoCantEntradas">
              ${evento.entradasPorUsuario ?? '—'}
            </span>
          </div>

          ${
            totalPendientes > 0
              ? `
            <div class="limite-row">
              <span class="label">Pendientes:</span>
              <span class="value infoCantEntradas">${totalPendientes}</span>
            </div>`
              : ''
          }

          <div class="limite-row total">
            <span class="label">Disponibles ahora:</span>
            <span class="value highlight">${disponiblesAhora}</span>
          </div>
        </div>

        <div class="cant-wrapper">
          <button id="menos" class="cant-btn" ${
            disponiblesAhora <= 1 ? 'disabled' : ''
          }>–</button>
          <input id="cant" value="1" min="1" max="${Math.max(
            1,
            disponiblesAhora
          )}" ${disponiblesAhora <= 0 ? 'disabled' : ''}>
          <button id="mas" class="cant-btn" ${
            disponiblesAhora <= 1 ? 'disabled' : ''
          }>+</button>
        </div>

        <p id="total" class="total-box">
          Total: <b>${esGratis ? 'GRATIS' : '$' + precioBase}</b>
        </p>

        ${
          esGratis
            ? `<p class="free-info">Confirmá la cantidad.</p>`
            : `
          <div class="metodos-wrapper">
            <button id="mp" type="button" class="method-btn method-mp only-logo" ${
              disponiblesAhora <= 0 ? 'disabled' : ''
            }>
              <img
                src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadopago/logo__large.png"
                alt="Mercado Pago"
                class="mp-logo"
              />
            </button>

            <button id="transfer" type="button" class="method-btn method-transfer" ${
              disponiblesAhora <= 0 ? 'disabled' : ''
            }>
              TRANSFERENCIA
            </button>
          </div>`
        }
      </div>
    `,

    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    showConfirmButton: esGratis,
    confirmButtonText: 'Confirmar',

    // ✅ ACA VA EL BLOQUE QUE PREGUNTABAS
    didOpen: () => {
      const input = document.getElementById('cant')
      const total = document.getElementById('total')

      const actualizar = () => {
        let v = Number(input.value)
        if (v < 1) v = 1
        if (v > disponiblesAhora) v = disponiblesAhora

        cantidad = v
        input.value = v

        total.innerHTML = esGratis
          ? `Total: <b>GRATIS</b>`
          : `Total: <b>$${v * precioBase}</b>`
      }

      document.getElementById('menos').onclick = () => {
        input.value--
        actualizar()
      }

      document.getElementById('mas').onclick = () => {
        input.value++
        actualizar()
      }

      input.oninput = actualizar
      actualizar()

      if (!esGratis) {
        document.getElementById('mp').onclick = () => {
          metodoSeleccionado = 'mp'
          Swal.close()
        }

        document.getElementById('transfer').onclick = () => {
          metodoSeleccionado = 'transfer'
          Swal.close()
        }
      }
    },
  })

  // 🛑 Gratis → depende del confirm
  if (esGratis) {
    if (!res || !res.isConfirmed) return { cancelado: true }
    return { cantidad, metodo: 'free' }
  }

  // ✅ Pago → si eligió método, NO es cancel
  if (metodoSeleccionado) {
    return { cantidad, metodo: metodoSeleccionado }
  }

  return { cancelado: true }
}

// ======================================================================
// SWAL FINAL
// ======================================================================
export async function swalEntradasGeneradas({ eventoNombre, cantidad }) {
  const res = await Swal.fire({
    title: '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;">
        ${cantidad} entrada(s) para <b>${eventoNombre}</b> fueron generadas 🎟️
      </p>
    `,
    icon: 'success',

    showCancelButton: true,
    confirmButtonText: 'Ir a Mis Entradas',
    cancelButtonText: 'Seguir en eventos',

    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel',
    },

    buttonsStyling: false,
    timer: 3500,
    timerProgressBar: true,
  })

  if (res.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))
  return 'seguir'
}
