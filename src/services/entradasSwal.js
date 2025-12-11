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
    maxCantidad = 1,
    limiteUsuario,
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

  const disponiblesAhora = Math.max(0, Math.min(limiteUsuario, cuposLote))

  let cantidad = 1

  return await MySwal.fire({
    title: `<span class="swal-title-main">${evento.nombre.toUpperCase()}</span>`,

    html: `
      <div class="resumen-lote-box">

        <p><b>Lote:</b> ${lote.nombre.toUpperCase()}</p>

        <hr />


        
        <div class="info-limites-box">
      <div class="limite-row">
        <span class="label">Máximo permitido por cuenta:</span>
        <span class="value">${evento.entradasPorUsuario ?? '—'}</span>
      </div>
          ${
            totalObtenidas > 0
              ? `
            <div class="limite-row">
              <span class="label">Tus entradas:</span>
              <span class="value">${totalObtenidas}</span>
            </div>`
              : ''
          }

          ${
            totalPendientes > 0
              ? `
            <div class="limite-row">
              <span class="label">Pendientes:</span>
              <span class="value">${totalPendientes}</span>
            </div>`
              : ''
          }



          <div class="limite-row total">
            <span class="label">Disponibles ahora:</span>
            <span class="value highlight">${disponiblesAhora}</span>
          </div>

        </div>

        <div class="cant-wrapper">
          <button id="menos" class="cant-btn">–</button>
          <input id="cant" value="1" min="1" max="${disponiblesAhora}">
          <button id="mas" class="cant-btn">+</button>
        </div>

        <p id="total" class="total-box">
          Total: <b>${esGratis ? 'GRATIS' : '$' + precioBase}</b>
        </p>

        ${
          esGratis
            ? `<p class="free-info">Confirmá la cantidad.</p>`
            : `
        <div class="metodos-wrapper">
          <button id="mp" class="method-btn">💳 Mercado Pago</button>
          <button id="transfer" class="method-btn">🔄 Transferencia</button>
        </div>`
        }
      </div>
    `,

    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    showConfirmButton: esGratis,
    confirmButtonText: 'Confirmar',

    didOpen: () => {
      const input = document.getElementById('cant')
      const total = document.getElementById('total')

      function actualizar() {
        let v = Number(input.value)
        if (v < 1) v = 1
        if (v > disponiblesAhora) v = disponiblesAhora
        cantidad = v
        input.value = v
        total.innerHTML = esGratis
          ? `Total: <b>GRATIS</b>`
          : `Total: <b>$${v * precioBase}</b>`
      }

      input.oninput = actualizar
      document.getElementById('menos').onclick = () => {
        input.value = Number(input.value) - 1
        actualizar()
      }
      document.getElementById('mas').onclick = () => {
        input.value = Number(input.value) + 1
        actualizar()
      }
      actualizar()

      if (!esGratis) {
        document.getElementById('mp').onclick = () => {
          window._swalValue = { cantidad, metodo: 'mp' }
          Swal.close()
        }
        document.getElementById('transfer').onclick = () => {
          window._swalValue = { cantidad, metodo: 'transfer' }
          Swal.close()
        }
      }
    },
  }).then(res => {
    if (esGratis) {
      if (!res.isConfirmed) return { cancelado: true }
      return { cantidad, metodo: 'free' }
    }
    if (res.dismiss === Swal.DismissReason.cancel) return { cancelado: true }
    return window._swalValue
  })
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
