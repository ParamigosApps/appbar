// --------------------------------------------------------------
// src/services/entradasSwal.js — PASSLINE PRO 2025 (FINAL CLEAN)
// --------------------------------------------------------------

import Swal from 'sweetalert2'
import { formatearSoloFecha } from '../utils/utils.js'
import { calcularDisponiblesAhora } from '../utils/calcularDisponiblesAhora.js'

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

function estadoLote(l, evento) {
  if (!evento?.fecha) return 'invalido'

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const fechaEvento = new Date(evento.fecha)
  fechaEvento.setHours(0, 0, 0, 0)

  if (fechaEvento.getTime() === hoy.getTime()) return 'hoy'
  if (fechaEvento > hoy) return 'proximo'
  return 'pasado'
}

// ======================================================================
// SELECCIÓN MULTI LOTE — PRO (MISMO DISEÑO, CON CANTIDADES)
// ======================================================================
export async function abrirSeleccionLotesMultiPro(
  evento,
  lotes,
  theme = 'light'
) {
  const MySwal = crearSwalConTheme(theme)

  // 🔒 Normalizar estado con string
  const estado = {}
  lotes.forEach(l => (estado[String(l.index)] = 0))

  const html = `
    <!-- HEADER EVENTO -->
    <div class="swal-event-header">
      <div class="swal-event-title">${evento.nombre}</div>
      ${
        evento.fechaInicio
          ? `<div class="swal-event-sub">📅 ${formatearSoloFecha(
              evento.fechaInicio
            )}</div>`
          : ''
      }
      ${
        evento.lugar
          ? `<div class="swal-event-sub">📍 ${evento.lugar}</div>`
          : ''
      }
    </div>

    <!-- LOTES -->
    <div class="lotes-scroll">
      <div class="lotes-wrapper">
        ${lotes
          .map(l => {
            const id = String(l.index)

            const descripcion =
              l.descripcionLote || l.descripcion || l.descripcion_lote || ''

            const precioHtml =
              Number(l.precio) === 0
                ? `<span class="precio-valor badge-gratis">GRATIS</span>`
                : `<span class="precio-valor badge-pago">$${l.precio}</span>`

            const badgeConsumicion = l.incluyeConsumicion
              ? `<span class="lote-badge badge-consu-ok">🍸 CON CONSUMICIÓN</span>`
              : `<span class="lote-badge badge-consu-no">SIN CONSUMICIÓN</span>`

            const maxSeleccionable = Number.isFinite(Number(l.restantes))
              ? Number(l.restantes)
              : 0

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
<div class="lote-card lote-multi" data-id="${id}">
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

  <div class="lote-horario-box">
    <span class="lote-label">INGRESO PERMITIDO:</span>
   <span>
  <strong class="lote-hora">
    ${l.desdeHora ? `${l.desdeHora}hs` : '-'}
    →
    ${l.hastaHora ? `${l.hastaHora}hs` : '-'}
  </strong>
</span>

  </div>

<div class="lote-info-left">
  <div class="lote-costo-row">
    <span class="lote-label">COSTO:</span>

    <div class="lote-badges-inline">
      ${precioHtml}
      ${badgeConsumicion}
    </div>
  </div>
</div>



  <div class="lote-footer-flex">
    <div class="lote-cantidad-box">
      <label class="lote-label">CANTIDAD</label>
<select
  class="lote-select-cant"
  data-id="${id}"
  ${maxSeleccionable === 0 ? 'disabled' : ''}
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
// SELECCIÓN DE LOTE
// ======================================================================
export async function abrirSeleccionLote(evento, lotes, theme = 'light') {
  const MySwal = crearSwalConTheme(theme)
  const lotesOrdenados = [...lotes].sort((a, b) => {
    // 1️⃣ Estado del evento
    const ea = estadoLote(a, evento)
    const eb = estadoLote(b, evento)

    const ordenEstado = { hoy: 0, proximo: 1, pasado: 2 }
    if (ordenEstado[ea] !== ordenEstado[eb]) {
      return ordenEstado[ea] - ordenEstado[eb]
    }

    // 2️⃣ Precio (GRATIS primero)
    const pa = Number(a.precio ?? 0)
    const pb = Number(b.precio ?? 0)

    if (pa !== pb) {
      return pa - pb // 0 primero → GRATIS
    }

    // 3️⃣ Mismo precio → más stock primero
    return (b.restantes ?? 0) - (a.restantes ?? 0)
  })

  return await MySwal.fire({
    title: `<span class="swal-title-main">${evento.nombre}</span>`,

    html: `
      <div class="lotes-scroll">
        <div id="swal-lotes" class="lotes-wrapper">
${lotesOrdenados
  .map(l => {
    const agotado = l.restantes <= 0
    const porc =
      l.cantidad > 0 ? Math.round((l.restantes / l.cantidad) * 100) : 0

    const estado = estadoLote(l, evento)
    const esHoy = estado === 'hoy'
    const esPasado = estado === 'pasado'

    const generoRaw = l.genero?.toLowerCase()

    const generoClase =
      generoRaw === 'mujeres'
        ? 'badge-rose'
        : generoRaw === 'hombres'
        ? 'badge-blue'
        : 'badge-unisex'

    // etiqueta fija + valor en badge (imitando COSTO)
    const generoLabel =
      generoRaw === 'mujeres' || generoRaw === 'hombres'
        ? 'EXCLUSIVO:'
        : 'GÉNERO:'

    const generoValue =
      generoRaw === 'mujeres'
        ? 'MUJERES'
        : generoRaw === 'hombres'
        ? 'HOMBRES'
        : 'TODOS'

    // ✅ MISMA IDEA QUE COSTO: <label> + <valor>
    const generoBadge = `
  <div class="lote-costo-box lote-genero-box">
    <span class="lote-label">${generoLabel}</span>
    <span class="lote-badge ${generoClase}">${generoValue}</span>
  </div>
`

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

    const badgeHoy = esHoy
      ? `<span class="lote-badge badge-hoy">🟢 HOY</span>`
      : ''

    const fechaHtml =
      evento.fechaInicio && formatearSoloFecha
        ? `<div class="lote-fecha-top-abs">${formatearSoloFecha(
            evento.fechaInicio
          )}</div>`
        : ''

    const mostrarCTA = !agotado && !esPasado

    return `
<div class="lote-card ${agotado ? 'lote-sin-cupos' : ''} ${
      esPasado ? 'lote-pasado' : ''
    }" data-id="${l.index}">

  ${fechaHtml}

  <div class="lote-nombre-principal">
    <span class="lote-label">LOTE:</span> ${String(l.nombre).toUpperCase()}
  </div>

  ${
    l.descripcionLote?.trim()
      ? `<div class="lote-desc"><span class="lote-label">DESCRIPCIÓN: </span>${l.descripcionLote}</div>`
      : ''
  }

  <div class="lote-horario-box">
    <span class="lote-label">HORA DE INGRESO:</span>
    <span class="lote-horario-value">${l.desdeHora || '-'} → ${
      l.hastaHora || '-'
    }</span>
  </div>

  <div class="lote-badges">
    ${badgeHoy}
    ${generoBadge}
    ${consumicionBadge}
    ${badgeStock}
  </div>

  <div class="lote-costo-box">
    <span class="lote-label">COSTO:</span>
    ${precioHtml}
  </div>

  <div class="lote-footer-flex">
    ${
      !mostrarCTA
        ? `<div class="lote-agotado-btn">${
            esPasado ? 'NO VIGENTE' : 'AGOTADO'
          }</div>`
        : `<div class="lote-select-mini">ADQUIRIR</div>`
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

  const cuposReales = Number.isFinite(lote?.restantes)
    ? Number(lote.restantes) // evento con lote
    : Number(evento?.cupos) > 0
    ? Number(evento.cupos) // evento sin lote pero con cupo global
    : Infinity // evento sin límite de cupos

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

  const disponiblesAhora = calcularDisponiblesAhora({
    evento,
    limiteUsuario,
    totalObtenidas,
    totalPendientes,
    cuposLote: cuposReales,
    maxCantidad,
  })

  let cantidad = 1
  let metodoSeleccionado = null
  console.log(totalObtenidas)

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
              ${evento.entradasPorUsuario ?? '—'}
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
              TRANSFERENCIA
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
    timer: 3500,
    timerProgressBar: true,
  })

  if (res.isConfirmed) document.dispatchEvent(new Event('abrir-mis-entradas'))
  return 'seguir'
}
