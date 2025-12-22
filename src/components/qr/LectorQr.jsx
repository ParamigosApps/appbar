// --------------------------------------------------------------
// src/components/qr/LectorQr.jsx — VERSION FINAL 2025 QR PRO
// --------------------------------------------------------------
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { Html5Qrcode } from 'html5-qrcode'

import {
  decodificarQr,
  analizarPayload,
  validarTicket,
  validarCompra,
  marcarEntradaUsada,
  detectarTipoPorFirestore,
} from '../../services/lectorQr.js'

import {
  registrarPagoCompra,
  registrarRetiroCompra,
  cancelarPagoCompra,
} from '../../services/cajaService.js'
import { mostrarComprobanteCaja } from '../../services/comprobanteService.js'
import { db, auth } from '../../Firebase.js'
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'

import { logTicket } from '../../services/logsService'

async function extenderExpiracionCompraSimple(pedido) {
  if (!pedido?.id || !pedido.expiraEn?.seconds) {
    throw new Error('Pedido sin expiración válida')
  }

  const ahora = Date.now()
  const expiraActual = pedido.expiraEn.seconds * 1000

  if (expiraActual <= ahora) {
    throw new Error('El pedido ya expiró')
  }

  const nuevaFecha = new Date(expiraActual + 5 * 60 * 1000)

  await updateDoc(doc(db, 'compras', pedido.id), {
    expiraEn: Timestamp.fromDate(nuevaFecha),
  })

  return nuevaFecha
}

// --------------------------------------------------------------
// Determinar si un evento está vigente HOY
// --------------------------------------------------------------
function eventoEstado(ev) {
  if (!ev?.fechaInicio || !ev?.fechaFin) return 'invalido'

  const ahora = new Date()

  const inicio = ev.fechaInicio.toDate()
  const fin = ev.fechaFin.toDate()

  // 🔑 Normalizamos a "solo fecha"
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  const diaInicio = new Date(
    inicio.getFullYear(),
    inicio.getMonth(),
    inicio.getDate()
  )

  const diaFin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())

  // 🟢 El día de inicio ya cuenta como vigente
  if (hoy >= diaInicio && hoy <= diaFin) return 'vigente'

  // ⏳ Todavía no llegó el día
  if (hoy < diaInicio) return 'proximo'

  return 'pasado'
}

function fechaLargaTimestamp(ts) {
  if (!ts) return 'No definida'
  const d = ts.toDate()
  return d.toLocaleDateString('es-AR')
}

export default function LectorQr({ modoInicial = 'entradas' }) {
  const navigate = useNavigate()

  // --------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------
  const [modo] = useState(modoInicial) // 'entradas' | 'caja'
  const [resultado, setResultado] = useState(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [eventoInfo, setEventoInfo] = useState(null)
  const [infoAbierto, setInfoAbierto] = useState(false)
  const [pedidoCaja, setPedidoCaja] = useState(null)
  const selectorMostrado = useRef(false)

  // Scanner refs
  const html5Qr = useRef(null)
  const running = useRef(false)
  const initialized = useRef(false)
  const leyendo = useRef(false)

  const [, setTick] = useState(0)

  useEffect(() => {
    const i = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)

    return () => clearInterval(i)
  }, [])

  function tiempoRestante(expiraEn) {
    if (!expiraEn) return null

    let expiraMs = null

    // 🔹 Firestore Timestamp { seconds, nanoseconds }
    if (typeof expiraEn === 'object' && typeof expiraEn.seconds === 'number') {
      expiraMs = expiraEn.seconds * 1000
    }

    // 🔹 ISO String "2025-12-22T06:50:32.471Z"
    else if (typeof expiraEn === 'string') {
      const d = new Date(expiraEn)
      if (!isNaN(d.getTime())) {
        expiraMs = d.getTime()
      }
    }

    // 🔹 Date nativo
    else if (expiraEn instanceof Date) {
      expiraMs = expiraEn.getTime()
    }

    if (!expiraMs) return null

    const diff = expiraMs - Date.now()
    if (diff <= 0) return null

    const totalSeconds = Math.floor(diff / 1000)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60

    return {
      texto: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      totalSeconds,
    }
  }

  // --------------------------------------------------------------
  // BEEP OK
  // --------------------------------------------------------------
  function beep(freq, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration / 1000
      )
      osc.stop(ctx.currentTime + duration / 1000)
    } catch {}
  }

  const beepOk = () => beep(900, 130)
  const tituloTexto =
    modo === 'entradas'
      ? 'Seleccioná el evento a verificar entradas:'
      : 'Seleccioná el evento activo de caja:'

  // --------------------------------------------------------------
  // SELECCIÓN DE EVENTO (ENTRADAS)
  // --------------------------------------------------------------
  useEffect(() => {
    if (modo !== 'entradas') return
    if (selectorMostrado.current) return

    selectorMostrado.current = true

    async function cargarEventos() {
      const snap = await getDocs(query(collection(db, 'eventos')))
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (!arr.length) {
        navigate('/admin', { replace: true })
        return
      }

      let html = `
      <div style="font-size:15px;margin-bottom:8px;margin-top:16px;">
        ${tituloTexto}
      </div>
      <select id="evento-select" class="swal2-select" style="width:100%;padding:12px">
        <option disabled selected value="">Elegí un evento</option>
    `

      arr.forEach(ev => {
        const estado = eventoEstado(ev)
        if (estado === 'pasado') return

        const disabled = estado === 'proximo' ? 'disabled' : ''
        const color = estado === 'proximo' ? 'style="color:#9ca3af"' : ''
        const tag =
          estado === 'vigente'
            ? '🟢 HOY'
            : estado === 'proximo'
            ? '⏳ PRÓXIMO'
            : ''

        html += `
        <option value="${ev.id}" ${disabled} ${color}>
          ${tag} ${ev.nombre} — ${fechaLargaTimestamp(ev.fechaInicio)}
        </option>
      `
      })

      html += `</select>`

      const res = await Swal.fire({
        title: 'Seleccionar evento',
        html,
        confirmButtonText: 'Continuar',
        showCloseButton: true,
        allowOutsideClick: false,

        customClass: {
          popup: 'swal-select-evento',
          confirmButton: 'swal-btn-confirm',
        },

        preConfirm: () => {
          const el = document.getElementById('evento-select')
          if (!el?.value) {
            Swal.showValidationMessage('Seleccioná un evento válido')
            return false
          }
          return el.value
        },
      })

      // ❌ Cerró sin elegir → recién AHORA navegamos
      if (res.isDismissed || !res.value) {
        navigate('/admin', { replace: true })
        return
      }

      // ✅ Evento válido
      setEventoSeleccionado(res.value)
      await cargarEstadisticasEvento(res.value)
    }

    cargarEventos()
  }, [modo, navigate])

  // --------------------------------------------------------------
  // ESTADÍSTICAS EVENTO
  // --------------------------------------------------------------
  async function cargarEstadisticasEvento(eventoId) {
    const snapEv = await getDoc(doc(db, 'eventos', eventoId))
    if (!snapEv.exists()) return

    const ev = snapEv.data()

    const qTot = query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId)
    )
    const tot = await getDocs(qTot)

    const qUsed = query(
      collection(db, 'entradas'),
      where('eventoId', '==', eventoId),
      where('usado', '==', true)
    )
    const usados = await getDocs(qUsed)

    setEventoInfo({
      ...ev,
      totales: tot.size,
      usadas: usados.size,
      noUsadas: tot.size - usados.size,
      capacidad: ev.capacidad ?? null,
    })
  }

  // --------------------------------------------------------------
  // SCANNER INIT
  // --------------------------------------------------------------
  useEffect(() => {
    // ⛔ no iniciar sin modo válido
    if (!['entradas', 'caja'].includes(modo)) return

    // ⛔ entradas requiere evento
    if (modo === 'entradas' && !eventoSeleccionado) return

    if (!initialized.current) {
      initialized.current = true
      setTimeout(iniciarScanner, 300)
    }

    return () => detenerScanner()
  }, [modo, eventoSeleccionado])

  async function iniciarScanner() {
    const el = document.getElementById('qr-reader')
    if (!el || running.current) return

    if (!html5Qr.current) html5Qr.current = new Html5Qrcode('qr-reader')

    const cams = await Html5Qrcode.getCameras()
    if (!cams.length) {
      Swal.fire('Sin cámara', 'No se detectó cámara.', 'error')
      return
    }

    await html5Qr.current.start(
      cams[cams.length - 1].id,
      { fps: 10, qrbox: 250 },
      onScanSuccess
    )

    running.current = true
  }

  async function detenerScanner() {
    if (!html5Qr.current || !running.current) return
    await html5Qr.current.stop()
    running.current = false
  }

  // --------------------------------------------------------------
  // SCAN SUCCESS
  // --------------------------------------------------------------
  async function onScanSuccess(text) {
    if (leyendo.current) return
    leyendo.current = true

    try {
      if (modo === 'caja' && pedidoCaja) {
        mostrarError(
          'Finalizá o cerrá el pedido actual antes de escanear otro.'
        )
        return
      }

      let dec = decodificarQr(text)
      let payload = analizarPayload(dec)

      // 🔍 Si el QR no indica tipo, lo resolvemos contra Firestore
      const idPlano =
        payload.entradaId ||
        payload.compraId ||
        payload.id ||
        dec.payload?.id ||
        dec.id ||
        text

      if (payload.tipo === 'desconocido' && idPlano) {
        console.log('🔎 Resolviendo tipo por Firestore:', idPlano)

        const detectado = await detectarTipoPorFirestore(idPlano)

        payload = {
          ...payload,
          ...detectado,
        }

        console.log('✅ Tipo resuelto:', payload)
      }

      let res = null

      // =========================
      // MODO ENTRADAS — FINAL PROD
      // =========================
      if (modo === 'entradas') {
        // 1️⃣ Resolver tipo si el QR es mínimo
        if (!payload.esEntrada) {
          if (!payload.id) {
            mostrarError('QR inválido')
            return
          }

          const detectado = await detectarTipoPorFirestore(payload.id)
          payload = { ...payload, ...detectado }
        }
        const detectado = await detectarTipoPorFirestore(payload.id)
        console.log('🧪 detectado:', detectado)
        payload = { ...payload, ...detectado }
        // 2️⃣ A esta altura, SOLO Firestore decide
        if (!payload.esEntrada) {
          mostrarError('QR no corresponde a una entrada')
          return
        }

        // 3️⃣ Validación REAL (Firestore)
        const resultadoValidacion = await validarTicket(
          payload,
          eventoSeleccionado
        )

        // 4️⃣ Fallo de validación
        if (!resultadoValidacion?.ok) {
          mostrarResultado(resultadoValidacion)
          return
        }

        // 5️⃣ Comparación FINAL de evento
        if (resultadoValidacion.data.eventoId !== eventoSeleccionado) {
          console.warn('⛔ Evento incorrecto', {
            scanner: eventoSeleccionado,
            entrada: resultadoValidacion.data.eventoId,
          })

          mostrarError(
            'Esta entrada pertenece a otro evento y no puede validarse aquí.'
          )
          return
        }

        // 6️⃣ OK
        console.log('🎯 EVENTO OK', {
          evento: eventoSeleccionado,
          entrada: resultadoValidacion.data.eventoId,
        })

        mostrarResultado(resultadoValidacion)

        // 7️⃣ Marcar como usada
        await marcarEntradaUsada(resultadoValidacion.data.id)
        cargarEstadisticasEvento(eventoSeleccionado)

        return
      }

      // =========================
      // MODO CAJA
      // =========================
      // Si el QR ya trae compraId, validamos directo.
      // Si NO trae compraId pero trae ticketId (tu caso real), resolvemos por query 1 vez.
      let compraIdFinal = payload.compraId

      if (!compraIdFinal) {
        const ticket = payload.ticketId || payload.id
        if (!ticket) {
          mostrarError('QR inválido (sin ticketId)')
          return
        }

        const qCompra = query(
          collection(db, 'compras'),
          where('ticketId', '==', ticket)
        )
        const snap = await getDocs(qCompra)

        if (snap.empty) {
          mostrarError('Compra no encontrada para este ticket')
          return
        }

        compraIdFinal = snap.docs[0].id
      }

      res = await validarCompra({ compraId: compraIdFinal })
      console.log('EXPIRA EN:', res.data?.expiraEn)
      const estado = res.data?.estado

      // ❌ Estados NO permitidos
      if (estado === 'expirado') {
        mostrarError('Pedido expirado')
        return
      }

      if (estado === 'retirado') {
        mostrarError('Pedido ya retirado')
        return
      }

      // ❌ Cualquier otro estado raro
      if (!['pendiente', 'pagado'].includes(estado)) {
        mostrarError('Estado de pedido no válido')
        return
      }
      // 🔒 PASO 5 — VALIDACIÓN DE ESTADO DE COMPRA
      if (!res?.ok || res.tipo !== 'compra') {
        mostrarError('Compra inválida')
        return
      }

      mostrarResultado(res)

      if (res?.ok && res.tipo === 'compra') {
        console.log('🧾 pedidoCaja recibido:', res.data)
        setPedidoCaja(res.data)
      }
    } catch (err) {
      console.error('Error al procesar QR:', err)
      mostrarError('Error procesando el QR')
    } finally {
      setTimeout(() => {
        leyendo.current = false
      }, 1200)
    }
  }

  // --------------------------------------------------------------
  // RESULTADO
  // --------------------------------------------------------------
  function mostrarResultado(res) {
    setResultado(res)
    res?.ok && beepOk()
  }

  function mostrarError(msg) {
    mostrarResultado({
      ok: false,
      titulo: 'QR incorrecto',
      mensaje: msg,
    })
  }

  // --------------------------------------------------------------
  // CAJA — CONFIRMACIONES
  // --------------------------------------------------------------
  async function confirmarPago() {
    const r = await Swal.fire({
      title: 'Confirmar pago',
      html: `¿El cliente abonó <b>$${pedidoCaja.total}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cobrar',
      cancelButtonText: 'Volver',
      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-alt',
      },
    })

    if (!r.isConfirmed) return

    const u = auth.currentUser

    await registrarPagoCompra({
      compraId: pedidoCaja.id,
      compraData: pedidoCaja,
      empleado: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
    })

    setPedidoCaja(p => ({
      ...p,
      estado: 'pagado',
      pagado: true,
      origenPago: 'caja',
      pagadoPor: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
    }))
  }

  async function confirmarEntrega() {
    const u = auth.currentUser

    // 1️⃣ Confirmar intención de imprimir
    const r = await Swal.fire({
      title: 'Confirmar entrega',
      html: `
      Avanza para imprimir el ticket para el cliente.<br>
      <span style="font-size:13px;color:#6b7280">
        El pedido todavía no será marcado como retirado.
      </span>
    `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-alt',
      },
    })

    if (!r.isConfirmed) return

    if (pedidoCaja.retirada) {
      await Swal.fire({
        icon: 'error',
        title: 'Ticket ya entregado',
        text: 'Este pedido ya fue retirado y no puede reimprimirse.',
      })
      return
    }
    // 2️⃣ Detectar si YA fue impreso antes (reimpresión real)
    const esReimpresion = pedidoCaja.ticketImpreso === true

    if (esReimpresion) {
      const r2 = await Swal.fire({
        icon: 'warning',
        title: 'Reimpresión',
        html: `
        Este ticket ya fue impreso anteriormente. Solo imprimir en caso de error.<br>
      <span style="
        display:block;
        margin-top:6px;
        font-size:13px;
        color:#b91c1c;
        font-weight:600;
      ">
        ⚠️ Esta acción generará un registro en el sistema y notificará al administrador.
      </span>
      `,
        showCancelButton: true,
        confirmButtonText: 'Imprimir nuevamente',
        cancelButtonText: 'Cancelar',
        customClass: {
          confirmButton: 'swal-btn-confirm',
          cancelButton: 'swal-btn-alt',
        },
      })

      if (!r2.isConfirmed) return
    }

    // 3️⃣ Mostrar ticket y esperar ACCIÓN REAL
    const resultado = await mostrarComprobanteCaja({
      ...pedidoCaja,
      nombreEvento: pedidoCaja.nombreEvento,
      fechaEvento: pedidoCaja.fechaEvento,
    })

    // ❌ Si NO imprimió, no hacemos absolutamente nada
    if (!resultado?.impreso) return

    // 4️⃣ AHORA SÍ: log + marcar como impreso
    await logTicket({
      tipo: esReimpresion ? 'ticket_reimpreso' : 'ticket_impreso',
      compraData: pedidoCaja,
      empleado: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
    })

    if (!pedidoCaja.ticketImpreso) {
      await updateDoc(doc(db, 'compras', pedidoCaja.id), {
        ticketImpreso: true,
        ticketImpresoEn: serverTimestamp(),
      })

      // actualizar estado local
      setPedidoCaja(p => ({
        ...p,
        ticketImpreso: true,
      }))
    }

    // 5️⃣ Confirmación FINAL de entrega física
    const confirmRetiro = await Swal.fire({
      title: 'Confirmar entrega',
      html: `
      <b>¿El ticket fue entregado al cliente?</b><br>
      <span style="font-size:13px;color:#6b7280">
        Esta acción no se puede deshacer.
      </span>
    `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, ticket entregado',
      cancelButtonText: 'No',
      customClass: {
        confirmButton: 'swal-btn-confirm',
        cancelButton: 'swal-btn-alt',
      },
    })

    if (!confirmRetiro.isConfirmed) return

    // 6️⃣ Marcar retiro (irreversible)
    await registrarRetiroCompra({
      compraId: pedidoCaja.id,
      compraData: {
        ...pedidoCaja,
        estado: 'pagado', // requisito del service
        nombreEvento: pedidoCaja.nombreEvento,
      },
      empleado: {
        uid: u?.uid || null,
        nombre: u?.displayName || 'Caja',
        rol: 'caja',
      },
      origen: 'qr-caja',
    })

    // 7️⃣ Limpiar UI
    setPedidoCaja(null)
    setResultado(null)
  }

  async function cancelarPago() {
    if (!pedidoCaja) return

    try {
      const r = await Swal.fire({
        title: 'Cancelar cobro',
        html: `
        <p>El pedido volverá a estado <b>PENDIENTE</b>.</p>
        <p style="
          margin-top:6px;
          color:#b91c1c;
          font-weight:bold;
        ">
          ⚠️ Usar solo en caso de marcar como abonado por error.
        </p>
      `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar cobro',
        cancelButtonText: 'No',
        confirmButtonColor: '#b91c1c',
      })

      if (!r.isConfirmed) return

      const u = auth.currentUser

      await cancelarPagoCompra({
        compraId: pedidoCaja.id,
        compraData: pedidoCaja,
        empleado: {
          uid: u.uid,
          nombre: u.displayName || 'Caja',
          rol: 'caja',
        },
      })

      // 🔄 Estado local inmediato
      setPedidoCaja(p => ({
        ...p,
        estado: 'pendiente',
        pagado: false,
        pagadoEn: null,
        pagadoPor: null,
        origenPago: null,
      }))

      setResultado({
        ok: true,
        titulo: 'Pago cancelado',
        mensaje: 'El pedido volvió a estado pendiente.',
      })
    } catch (err) {
      Swal.fire({
        title: 'Acción no permitida',
        text: err.message,
        icon: 'error',
      })
    }
  }
  // --------------------------------------------------------------
  // UI
  // --------------------------------------------------------------
  return (
    <div className="container py-4">
      <div className="card p-4">
        <div className="d-flex justify-content-between mb-3">
          <h4>Validador QR</h4>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>

        {modo === 'entradas' && eventoSeleccionado && eventoInfo && (
          <div className="evento-activo">
            <div className="evento-activo-label">🎟 Evento seleccionado</div>

            <div className="evento-activo-nombre">{eventoInfo.nombre}</div>

            <div className="evento-activo-fecha">
              📅 {eventoInfo.fechaInicio?.toDate().toLocaleDateString('es-AR')}
              {eventoInfo.horaInicio && ` · ⏰ ${eventoInfo.horaInicio}`}
            </div>
          </div>
        )}

        <div id="qr-reader" />
        {pedidoCaja && (
          <div className="card mt-3 p-3">
            <h5>Pedido #{pedidoCaja.numeroPedido}</h5>
            <p>
              <b>Cliente:</b> {pedidoCaja.usuarioNombre}
            </p>
            <p>
              <b>Lugar:</b> {pedidoCaja.lugar}
            </p>
            <div
              className="estado-pedido mt-2 mb-3"
              style={{
                padding: '10px',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: '1.15rem',
                background:
                  pedidoCaja.estado === 'pagado'
                    ? '#16a34a' // verde
                    : pedidoCaja.estado === 'retirado'
                    ? '#15803d' // verde oscuro
                    : '#0c5728ff', // rojo (NO pagado)
              }}
            >
              {pedidoCaja.estado === 'pendiente' &&
                (() => {
                  const restante = tiempoRestante(pedidoCaja.expiraEn)

                  if (!restante) return null

                  const mostrarExtender = restante.totalSeconds <= 120 // ⬅️ 2 minutos

                  return (
                    <>
                      <div style={{ fontWeight: 'bold' }}>
                        PEDIDO VÁLIDO. ⚠️ <strong>FALTA ABONAR</strong>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 14 }}>
                        ⏳ Vence en: <strong>{restante.texto}</strong>
                      </div>

                      {mostrarExtender && (
                        <button
                          className="btn btn swal-btn-alt btn-sm mt-2"
                          onClick={async () => {
                            try {
                              const r = await Swal.fire({
                                title: 'Extender vencimiento',
                                text: '¿Extender 5 minutos este pedido?',
                                icon: 'question',
                                showCancelButton: true,
                                confirmButtonText: 'Extender',
                                cancelButtonText: 'Cancelar',
                                customClass: {
                                  confirmButton: 'swal-btn-confirm',
                                  cancelButton: 'swal-btn-alt',
                                },
                              })

                              if (!r.isConfirmed) return

                              const nuevaFecha =
                                await extenderExpiracionCompraSimple(pedidoCaja)

                              // 🔄 refresh local inmediato
                              setPedidoCaja(p => ({
                                ...p,
                                expiraEn: {
                                  seconds: Math.floor(
                                    nuevaFecha.getTime() / 1000
                                  ),
                                },
                              }))
                            } catch (err) {
                              Swal.fire('No permitido', err.message, 'error')
                            }
                          }}
                        >
                          ⏱ Extender 5 min
                        </button>
                      )}
                    </>
                  )
                })()}

              {pedidoCaja.estado === 'pagado' && '✅ PAGO CONFIRMADO'}
              {pedidoCaja.estado === 'retirado' && '🎫 TICKET ENTREGADO'}
            </div>
            {pedidoCaja.estado === 'pagado' &&
              pedidoCaja.origenPago === 'caja' &&
              pedidoCaja.pagadoPor?.uid === auth.currentUser?.uid && (
                <button
                  className="btn btn-outline-danger w-5' mt-2"
                  onClick={cancelarPago}
                >
                  Cancelar cobro
                </button>
              )}
            <hr />
            {(pedidoCaja.items || pedidoCaja.carrito || []).map((p, i) => (
              <div key={i} className="d-flex justify-content-between">
                <span>
                  {p.nombre} ×{p.enCarrito}
                </span>
                <span>${p.precio * p.enCarrito}</span>
              </div>
            ))}
            <hr />
            <div className="d-flex justify-content-between fs-5">
              <strong>Total</strong>
              <strong>${pedidoCaja.total}</strong>
            </div>
            {pedidoCaja.estado === 'pendiente' && (
              <button
                className="btn swal-btn-confirm w-75 mx-auto mt-4"
                onClick={confirmarPago}
              >
                Confirmar pago
              </button>
            )}
            {pedidoCaja.estado === 'pagado' && (
              <button
                className="btn swal-btn-confirm w-75 mx-auto mt-4"
                onClick={confirmarEntrega}
              >
                Generar ticket
              </button>
            )}

            <button
              className="btn swal-btn-alt w-50 mx-auto mt-2"
              onClick={() => {
                Swal.fire({
                  title: '¿Desea cerrar el pedido?',
                  text: 'Podrás escanear el QR nuevamente.',
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonText: 'Sí, cerrar',
                  cancelButtonText: 'Volver',
                  customClass: {
                    confirmButton: 'swal-btn-confirm',
                    cancelButton: 'swal-btn-alt',
                  },
                }).then(r => {
                  if (r.isConfirmed) {
                    setPedidoCaja(null)
                    setResultado(null)
                  }
                })
              }}
            >
              Cerrar pedido
            </button>
          </div>
        )}

        {resultado && (
          <div
            className={`mt-3 p-3 ${
              resultado.ok ? 'text-success' : 'text-danger'
            }`}
          >
            <h5>{resultado.titulo}</h5>
            <p dangerouslySetInnerHTML={{ __html: resultado.mensaje }} />
          </div>
        )}
      </div>
    </div>
  )
}
