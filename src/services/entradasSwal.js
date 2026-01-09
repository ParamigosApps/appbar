// --------------------------------------------------------------
// src/services/entradasSwal.js — PASSLINE PRO 2025 (FINAL CLEAN)
// --------------------------------------------------------------

import Swal from 'sweetalert2'

import { calcularDisponiblesAhora } from '../utils/calcularDisponiblesAhora.js'
import { formatearFechaEventoDescriptiva } from '../utils/utils.js'
// ======================================================================
// CREAR THEME
// ======================================================================
function crearSwalConTheme(theme = 'light') {
  const themeClass = typeof theme === 'string' && theme.trim() ? theme : 'light'

  document.body.classList.remove('light', 'dark')
  document.body.classList.add(themeClass)

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
// SELECCIÓN MULTI LOTE — PRO (MISMO DISEÑO, CON CANTIDADES)
// ======================================================================

export async function abrirSeleccionLotesMultiPro(evento, lotes, options = {}) {
  const {
    theme = 'light',
    entradasUsuarioPorLote = {},
    pendientesUsuarioPorLote = {},
  } = options

  const MySwal = crearSwalConTheme(theme)

  // 🔒 Normalizar estado con string
  const estado = {}

  lotes.forEach(l => (estado[String(l.index)] = 0))

  const html = `
<!-- HEADER EVENTO -->
<div class="swal-event-header">
  <div class="swal-event-title">
    ${evento.nombre}
  </div>

  ${
    evento.fechaInicio
      ? `<div class="swal-event-sub">
  <span class="swal-event-icon">📅</span>
  ${formatearFechaEventoDescriptiva(evento.fechaInicio, evento.horaInicio)}

</div>`
      : ''
  }

  ${
    evento.lugar
      ? `<div class="swal-event-sub muted">
           📍 ${evento.lugar}
         </div>`
      : ''
  }
</div>


    <!-- LOTES -->
    <div class="lotes-scroll">
      <div class="lotes-wrapper">
        ${lotes
          .map(l => {
            const total = Number(l.cantidadInicial || 0)
            const restantes = Number(l.cantidadDisponible || 0)
            const disponiblesAhora = Number(l.disponiblesUsuario || 0)

            // % DISPONIBLE (visual)
            const porcentaje =
              total > 0 ? Math.round((restantes / total) * 100) : 0

            // ================================
            // STOCK / DISPONIBILIDAD (POR LOTE)
            // ================================
            let badgeIngreso = ''
            let claseIngreso = 'badge-ingreso-ok'
            const [h, m] = l.hastaHora.split(':').map(Number)
            const minutos = h * 60 + m

            if (l.hastaHora) {
              // antes de las 02:00 → 120 minutos
              if (minutos < 121) {
                claseIngreso = 'badge-ingreso-early'
                badgeIngreso = '¡ATENCIÓN!'
              } else {
                badgeIngreso = 'INGRESO NORMAL'
              }
            }

            const mostrarIngresoLimite =
              Number.isFinite(minutos) && minutos > 0 && minutos <= 120

            // FIN BARRA STOCK
            const id = String(l.index)

            console.log('[STOCK LOTE]', {
              lote: l.nombre,
              cantidadInicial: l.cantidadInicial,
              cantidadDisponible: l.cantidadDisponible,
              porcentajeDisponible: porcentaje,
            })

            const descripcion =
              l.descripcionLote || l.descripcion || l.descripcion_lote || ''

            let badgeGenero = ''

            if (l.genero === 'mujeres') {
              badgeGenero = `<span class="lote-badge badge-genero-mujeres">♀ MUJERES</span>`
            } else if (l.genero === 'hombres') {
              badgeGenero = `<span class="lote-badge badge-genero-hombres">♂ HOMBRES</span>`
            } else {
              badgeGenero = `<span class="lote-badge badge-genero-unisex">⚥ UNISEX</span>`
            }

            const precioHtml =
              Number(l.precio) === 0
                ? `<span class="precio-valor badge-gratis">GRATIS</span>`
                : `<span class="precio-valor badge-pago">$${l.precio}</span>`

            const badgeConsumicion = l.incluyeConsumicion
              ? `<span class="lote-badge badge-consu-ok">🍸 CON CONSUMICIÓN</span>`
              : `<span class="lote-badge badge-consu-no">SIN CONSUMICIÓN</span>`

            const idx = String(l.index)

            const agotadoGlobal = restantes <= 0
            const agotadoUsuario = disponiblesAhora <= 0 && restantes > 0

            const mostrarBarra = porcentaje <= 30
            let estadoStock = 'ok'
            let textoStock = 'Disponibilidad alta'

            if (agotadoGlobal) {
              estadoStock = 'critical'
              textoStock = '¡LOTE AGOTADO!'
            } else if (agotadoUsuario) {
              estadoStock = 'warning'
              textoStock = '¡ALCANZASTE TU LÍMITE!'
            } else if (porcentaje <= 30) {
              estadoStock = 'warning'
              textoStock = '¡SE ESTÁ AGOTANDO!'
            }

            console.log(agotadoUsuario)
            // 🔑 HTML FINAL
            const barraStockHtml = mostrarBarra
              ? `
              <div class="stock-box stock-${estadoStock}">
                <div class="stock-header">
                  <span class="stock-text">${textoStock}</span>
                </div>

                <div class="stock-bar-row">
                  <div class="stock-bar">
                    <div class="stock-bar-fill" style="width:${porcentaje}%"></div>
                  </div>
                  <span class="stock-meta">${porcentaje}%</span>
                </div>
              </div>
            `
              : ''

            const maxSeleccionable = Math.max(0, disponiblesAhora)

            const opcionesCantidad =
              maxSeleccionable === 0
                ? `<option value="0">0</option>`
                : [
                    `<option value="0">0</option>`,
                    ...Array.from(
                      { length: maxSeleccionable },
                      (_, i) => `<option value="${i + 1}">${i + 1}</option>`
                    ),
                  ].join('')

            return `
<div class="lote-card lote-multi mb-2" data-id="${id}">
  <!-- STOCK OVERLAY -->


  <div class="lote-nombre-principal">
    <span class="lote-label">LOTE:</span> ${l.nombre.toUpperCase()}
  </div>

  ${
    descripcion
      ? `<div class="lote-desc">
           <span class="lote-label">DESCRIPCIÓN:</span>
           ${descripcion}
         </div>`
      : ''
  }

${
  mostrarIngresoLimite
    ? `
  <div class="lote-horario-box">
    <span class="lote-label">INGRESO LÍMITE:</span>
    <div class="lote-horario-row">
      <strong class="lote-hora badge-hora">
        ${l.hastaHora ? `${l.hastaHora}hs` : '-'}
      </strong>
      ${
        l.hastaHora
          ? `<span class="lote-badge ${claseIngreso}" id="badge-ingreso">
              ${badgeIngreso}
            </span>`
          : ''
      }
    </div>
  </div>
`
    : ''
}
  <div class="lote-info-left">
    <div class="lote-costo-row">
      <span class="lote-label">COSTO:</span>
      <div class="lote-badges-inline">
        ${precioHtml}
        ${badgeConsumicion}
      </div>
    </div>

    <div class="lote-genero-row">
      <span class="lote-label">${
        l.genero !== 'hombres' && l.genero !== 'mujeres'
          ? 'GÉNERO:'
          : 'EXCLUSIVO:'
      }</span>
      ${badgeGenero}
    </div>
      <div class="lote-stock-overlay">
    ${barraStockHtml || ''}
  </div>
  </div>

  <!-- FOOTER -->
  <div class="lote-footer-flex">
    <div class="lote-cantidad-box">
      <label class="lote-label">CANTIDAD</label>
      <select
        class="lote-select-cant"
        data-id="${id}"
        ${agotadoGlobal || agotadoUsuario ? 'disabled' : ''}
      >
        ${opcionesCantidad}
      </select>

    </div>
  </div>
</div>
`
          })
          .join('')}
      </div>
    </div>

    <!-- TOTAL -->
    <div id="resumen-total" class="total-box">
      Total: <b>$0</b>
    </div>
  `

  const res = await MySwal.fire({
    title: null,
    html,
    showCancelButton: true,
    confirmButtonText: 'Continuar',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    reverseButtons: true,
    preConfirm: () => {
      const seleccion = lotes
        .map(l => ({
          lote: l,
          cantidad: estado[String(l.index)],
        }))

        .filter(x => x.cantidad > 0)

      if (!seleccion.length) {
        Swal.showValidationMessage('Seleccioná al menos una entrada')
        return false
      }

      return seleccion
    },

    didOpen: () => {
      const actualizarTotal = () => {
        let total = 0
        lotes.forEach(l => {
          total += Number(l.precio || 0) * estado[String(l.index)]
        })

        document.getElementById('resumen-total').innerHTML =
          total === 0 ? 'Total: <b>GRATIS</b>' : `Total: <b>$${total}</b>`
      }

      document.querySelectorAll('.lote-select-cant').forEach(select => {
        select.onchange = () => {
          const id = select.dataset.id
          estado[id] = Number(select.value)
          actualizarTotal()
        }
      })
    },
  })

  return res.isConfirmed ? res.value : null
}

// ======================================================================
// RESUMEN DE LOTE
// ======================================================================
export async function abrirResumenLote(evento, lote, opciones = {}, theme) {
  const MySwal = crearSwalConTheme(theme)

  const {
    limiteUsuario = 0,
    totalObtenidas = 0,
    totalPendientes = 0,
    precioUnitario,
    esGratis: esGratisProp,
  } = opciones

  const precioBase =
    typeof precioUnitario === 'number'
      ? precioUnitario
      : Number(lote?.precio || 0)

  const esGratis = esGratisProp ?? precioBase === 0

  const disponiblesAhora = Number(lote.disponiblesUsuario || 0)

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
              <span class="label infoCantEntradas">Tus entradas:</span>
              <span class="value infoCantEntradas">${totalObtenidas}</span>
            </div>`
              : ''
          }

          <div class="limite-row">
            <span class="label infoMaximoEntradas">Máximo por cuenta:</span>
          <span class="value infoMaximoEntradas">
            ${limiteUsuario > 0 ? limiteUsuario : '—'}
          </span>
          </div>

          ${
            totalPendientes > 0
              ? `
            <div class="limite-row">
              <span class="label infoCantPendientes">Entradas pendientes:</span>
              <span class="value infoCantPendientes">${totalPendientes}</span>
            </div>`
              : ''
          }

          <div class="limite-row total">
            <span class="label infoDisponiblesEntradas">Disponibles ahora:</span>
            <span class="value highlight">${disponiblesAhora}</span>
          </div>
        </div>

        <div class="cant-wrapper">
          <button id="menos" class="cant-btn" ${
            disponiblesAhora <= 1 ? 'disabled' : ''
          }>–</button>
          <input
            id="cant"
            value="1"
            min="1"
            max="${Math.max(1, disponiblesAhora)}"
            ${disponiblesAhora <= 0 ? 'disabled' : ''}
          >
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
              Transferencia
            </button>
          </div>`
        }
      </div>
    `,
    allowOutsideClick: false,
    allowEscapeKey: false,

    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    showConfirmButton: esGratis,
    confirmButtonText: 'Confirmar',

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
  // ⛔ BLOQUEO TOTAL SI SE CERRÓ EL SWAL
  if (!res || res.isDismissed) {
    return { cancelado: true }
  }
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
    title: cantidad === 1 ? '¡Entrada generada!' : '¡Entradas generadas!',
    html: `
      <p style="font-size:18px;font-weight:600;text-align:center;">
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
    reverseButtons: true,
    timer: 3500,
    timerProgressBar: true,
  })

  if (res.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))
  return 'seguir'
}
