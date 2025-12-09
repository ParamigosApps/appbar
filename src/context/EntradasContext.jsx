// --------------------------------------------------------------
// src/context/EntradasContext.jsx — VERSIÓN LOTES + CUPOS
// --------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'

import { db } from '../Firebase.js'
import { useFirebase } from './FirebaseContext.jsx'
import { useAuth } from './AuthContext.jsx'
import { useQr } from './QrContext.jsx'
import { useTheme } from './ThemeContext.jsx'

import { crearPreferenciaEntrada } from '../services/mercadopago.js'
import Swal from 'sweetalert2'

const EntradasContext = createContext()
export const useEntradas = () => useContext(EntradasContext)

export function EntradasProvider({ children }) {
  const { user } = useFirebase()
  const { abrirLoginGlobal } = useAuth()
  const { mostrarQrReact } = useQr()
  const { theme } = useTheme()

  const [eventos, setEventos] = useState([])
  const [misEntradas, setMisEntradas] = useState([])
  const [entradasPendientes, setEntradasPendientes] = useState([])
  const [entradasUsadas, setEntradasUsadas] = useState([])
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [historial, setHistorial] = useState([])

  // ------------------------------------------------------
  // SweetAlert — tema oscuro / claro
  // ------------------------------------------------------
  function swalEstiloBase() {
    return {
      background: theme === 'dark' ? '#111' : '#fff',
      color: theme === 'dark' ? '#f1f1f1' : '#111',
    }
  }

  // ------------------------------------------------------
  // Cargar eventos
  // ------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      try {
        setLoadingEventos(true)
        const snap = await getDocs(collection(db, 'eventos'))
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        arr.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        setEventos(arr)
      } catch (e) {
        console.error('Error cargando eventos:', e)
      } finally {
        setLoadingEventos(false)
      }
    }
    cargar()
  }, [])

  // ------------------------------------------------------
  // Cargar mis entradas
  // ------------------------------------------------------
  useEffect(() => {
    if (!user) return setMisEntradas([])
    cargarEntradasUsuario(user.uid)
  }, [user])

  async function cargarEntradasUsuario(uid) {
    const q = query(collection(db, 'entradas'), where('usuarioId', '==', uid))
    const snap = await getDocs(q)
    setMisEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  // ------------------------------------------------------
  // Entradas pendientes (onSnapshot)
  // ------------------------------------------------------
  useEffect(() => {
    if (!user) return setEntradasPendientes([])

    const q = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const unsub = onSnapshot(q, snap => {
      setEntradasPendientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => unsub()
  }, [user])

  // ------------------------------------------------------
  // Helpers Configuración
  // ------------------------------------------------------
  async function obtenerDatosBancarios() {
    const ref = doc(db, 'configuracion', 'datosBancarios')
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data() : {}
  }

  async function obtenerContacto() {
    const ref = doc(db, 'configuracion', 'social')
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const { whatsappContacto, instagramContacto, tiktokContacto } = snap.data()
    return { whatsappContacto, instagramContacto, tiktokContacto }
  }

  // ------------------------------------------------------
  // crearSolicitudPendiente — ahora guarda info del lote
  // ------------------------------------------------------
  async function crearSolicitudPendiente(eventoId, usuarioId, entradaBase) {
    try {
      const existentes = await getDocs(
        query(
          collection(db, 'entradasPendientes'),
          where('eventoId', '==', eventoId),
          where('usuarioId', '==', usuarioId),
          // 🔹 si viene loteIndice, agrupamos por evento+usuario+lote
          ...(entradaBase.loteIndice !== undefined
            ? [where('loteIndice', '==', entradaBase.loteIndice)]
            : [])
        )
      )

      if (existentes.empty) {
        return await addDoc(collection(db, 'entradasPendientes'), {
          eventoId,
          usuarioId,
          usuarioNombre: user?.displayName || 'Usuario',
          eventoNombre: entradaBase.nombre,
          cantidad: entradaBase.cantidad,
          monto: entradaBase.cantidad * entradaBase.precio,
          estado: 'pendiente',
          creadaEn: new Date().toISOString(),
          fecha: entradaBase.fecha,
          lugar: entradaBase.lugar,
          horario: entradaBase.horario || 'A confirmar',
          precio: entradaBase.precio,
          // 💾 info de lote (si existe)
          loteIndice: entradaBase.loteIndice ?? null,
          loteNombre: entradaBase.loteNombre ?? null,
          loteGenero: entradaBase.loteGenero ?? 'todos',
          loteIncluyeConsumicion: entradaBase.loteIncluyeConsumicion ?? false,
        })
      } else {
        const ref = existentes.docs[0].ref
        const prev = existentes.docs[0].data().cantidad || 1
        const updatedCount = prev + entradaBase.cantidad

        return await updateDoc(ref, {
          cantidad: updatedCount,
          monto: updatedCount * entradaBase.precio,
          actualizadaEn: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Error creando solicitud pendiente:', err)
    }
  }

  // ------------------------------------------------------
  // pedirEntrada — soporta eventos con LOTES
  // ------------------------------------------------------
  async function pedirEntrada(e) {
    try {
      // 1) Login
      if (!user) {
        await Swal.fire({
          title: 'Debes iniciar sesión',
          text: 'Solo usuarios con cuenta pueden comprar entradas.',
          icon: 'warning',
          confirmButtonText: 'Iniciar sesión',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-dark' },
          ...swalEstiloBase(),
        })
        abrirLoginGlobal()
        return
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'
      const eventoId = e.id

      // 2) Datos del evento
      const eventoSnap = await getDoc(doc(db, 'eventos', eventoId))
      if (!eventoSnap.exists()) {
        return Swal.fire('Error', 'No se encontró el evento.', 'error')
      }
      const eventoData = eventoSnap.data()
      const lotes = Array.isArray(eventoData.lotes) ? eventoData.lotes : []

      // 3) Traer entradas existentes del evento (para cupos)
      const vendidasSnap = await getDocs(
        query(collection(db, 'entradas'), where('eventoId', '==', eventoId))
      )
      const pendientesSnap = await getDocs(
        query(
          collection(db, 'entradasPendientes'),
          where('eventoId', '==', eventoId)
        )
      )

      const vendidasDocs = vendidasSnap.docs
      const pendientesDocs = pendientesSnap.docs

      const totalVendidasEvento = vendidasDocs.reduce(
        (acc, d) => acc + (d.data().cantidad || 1),
        0
      )
      const totalPendientesEvento = pendientesDocs.reduce(
        (acc, d) => acc + (d.data().cantidad || 1),
        0
      )

      // 4) Capacidad total del evento (vendidas + pendientes descuentan)
      const entradasMaximasEvento = eventoData.entradasMaximasEvento || null
      let cupoRestanteEvento = null

      if (entradasMaximasEvento) {
        const totalFinal = totalVendidasEvento + totalPendientesEvento
        cupoRestanteEvento = entradasMaximasEvento - totalFinal

        if (cupoRestanteEvento <= 0) {
          return Swal.fire({
            title: 'Cupo completo',
            html: `<p>Este evento alcanzó su capacidad máxima.</p>`,
            icon: 'error',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }
      }

      // 5) Límite por usuario (suma de todos los lotes)
      const entradasPorUsuario = eventoData.entradasPorUsuario || 4

      const entradasCompradasUsuario = vendidasDocs.reduce((acc, d) => {
        const data = d.data()
        return data.usuarioId === usuarioId ? acc + (data.cantidad || 1) : acc
      }, 0)

      const pendientesUsuario = pendientesDocs.reduce((acc, d) => {
        const data = d.data()
        return data.usuarioId === usuarioId ? acc + (data.cantidad || 1) : acc
      }, 0)

      const totalActualUsuario = entradasCompradasUsuario + pendientesUsuario

      if (totalActualUsuario >= entradasPorUsuario) {
        return Swal.fire({
          title: 'Límite alcanzado',
          html: `<p>Máximo permitido: <strong>${entradasPorUsuario}</strong> entradas por usuario.</p>`,
          icon: 'warning',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-dark' },
          ...swalEstiloBase(),
        })
      }

      let maxPorUsuarioEvento = entradasPorUsuario - totalActualUsuario
      if (cupoRestanteEvento !== null) {
        maxPorUsuarioEvento = Math.min(maxPorUsuarioEvento, cupoRestanteEvento)
      }
      if (maxPorUsuarioEvento < 1) maxPorUsuarioEvento = 1

      // ======================================================
      //  CASO A: EVENTO CON LOTES
      // ======================================================
      if (lotes.length > 0) {
        // Calculamos disponibilidad por lote
        const lotesConInfo = lotes.map((lote, index) => {
          const capacidad = Number(lote.cantidad) || 0

          const vendidasLote = vendidasDocs.reduce((acc, d) => {
            const data = d.data()
            return data.loteIndice === index ? acc + (data.cantidad || 1) : acc
          }, 0)

          const pendientesLote = pendientesDocs.reduce((acc, d) => {
            const data = d.data()
            return data.loteIndice === index ? acc + (data.cantidad || 1) : acc
          }, 0)

          const restantes = capacidad - (vendidasLote + pendientesLote)
          const porcentajeRestante = capacidad > 0 ? restantes / capacidad : 0

          return {
            index,
            capacidad,
            restantes,
            porcentajeRestante,
            ...lote,
          }
        })

        const lotesDisponibles = lotesConInfo.filter(
          l => l.capacidad > 0 && l.restantes > 0
        )

        if (!lotesDisponibles.length) {
          return Swal.fire({
            title: 'Cupo agotado',
            html: `<p>No quedan entradas disponibles en los lotes configurados.</p>`,
            icon: 'error',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        // Modal para elegir lote (estilo C)
        const opcionesHtml = lotesDisponibles
          .map(l => {
            const precioNum = Number(l.precio) || 0
            const precioTxt = precioNum > 0 ? `$${precioNum}` : 'Free'
            const horarioTxt =
              l.desdeHora || l.hastaHora
                ? `⏰ válido de ${l.desdeHora || '--'} a ${l.hastaHora || '--'}`
                : ''
            const consumicionTxt = l.incluyeConsumicion
              ? '🍹 Incluye consumición'
              : ''
            const mostrarDisponibles = l.porcentajeRestante < 0.3
            const disponibilidadTxt = mostrarDisponibles
              ? `🔥 Quedan <strong>${l.restantes}</strong> entradas`
              : ''

            return `
              <label class="swal2-radio lote-opcion" style="
                display:block;
                text-align:left;
                margin-bottom:8px;
                padding:10px;
                border-radius:10px;
                border:1px solid #444;
              ">
                <input type="radio" name="loteOption" value="${
                  l.index
                }" style="margin-right:8px;">
                <div>
                  <div><strong>🎟 ${
                    l.nombre || 'Lote sin nombre'
                  } — ${precioTxt}</strong></div>
                  <div class="small">
                    ${horarioTxt ? horarioTxt + '<br/>' : ''}
                    ${consumicionTxt ? consumicionTxt + '<br/>' : ''}
                    ${disponibilidadTxt}
                  </div>
                </div>
              </label>
            `
          })
          .join('')

        const { value: indiceLoteSeleccionado } = await Swal.fire({
          title: e.nombre,
          html: `
            <p class="mb-2">Elegí el tipo de entrada que querés:</p>
            <div style="text-align:left;max-height:320px;overflow-y:auto;">
              ${opcionesHtml}
            </div>
          `,
          confirmButtonText: 'Continuar',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'btn btn-dark',
            cancelButton: 'btn btn-secondary',
          },
          ...swalEstiloBase(),
          preConfirm: () => {
            const seleccionado = document.querySelector(
              'input[name="loteOption"]:checked'
            )
            return seleccionado ? parseInt(seleccionado.value, 10) : null
          },
        })

        if (
          indiceLoteSeleccionado === null ||
          indiceLoteSeleccionado === undefined
        ) {
          return
        }

        const loteSel = lotesConInfo.find(
          l => l.index === indiceLoteSeleccionado
        )
        if (!loteSel) return

        const precioLote = Number(loteSel.precio) || 0

        // Máximo por este lote = mínimo entre lo disponible del lote y el máximo por usuario/evento
        let maxLoteUsuario = Math.min(loteSel.restantes, maxPorUsuarioEvento)
        if (maxLoteUsuario < 1) maxLoteUsuario = 1

        // --------------------------------------------------
        // Lote FREE
        // --------------------------------------------------
        if (precioLote <= 0) {
          const { value: cantidadFree } = await Swal.fire({
            title: `${e.nombre} — ${loteSel.nombre || 'Lote'}`,
            html: `
              <p>Entrada gratuita ✔</p>
              <label for="swal-cant-free">Cantidad (máx ${maxLoteUsuario}):</label>
              <input id="swal-cant-free" type="number" class="swal2-input"
                     min="1" max="${maxLoteUsuario}" value="1">
            `,
            confirmButtonText: 'Solicitar',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: {
              confirmButton: 'btn btn-success',
              cancelButton: 'btn btn-dark',
            },
            ...swalEstiloBase(),
            preConfirm: () =>
              parseInt(document.getElementById('swal-cant-free').value, 10) ||
              1,
          })

          if (!cantidadFree) return

          if (cantidadFree > maxLoteUsuario) {
            return Swal.fire({
              icon: 'warning',
              title: 'Límite superado',
              text: `Solo puedes solicitar ${maxLoteUsuario} entradas para este lote.`,
              buttonsStyling: false,
              customClass: { confirmButton: 'btn btn-dark' },
              ...swalEstiloBase(),
            })
          }

          const idsGeneradas = []

          for (let i = 0; i < cantidadFree; i++) {
            const ref = await addDoc(collection(db, 'entradas'), {
              eventoId,
              usuarioId,
              usuarioNombre,
              fecha: e.fecha,
              lugar: e.lugar,
              nombreEvento: e.nombre,
              pagado: true,
              precio: 0,
              cantidad: 1,
              creadoEn: new Date().toISOString(),
              usado: false,
              estado: 'aprobada',
              // info de lote
              loteIndice: loteSel.index,
              loteNombre: loteSel.nombre || null,
              loteGenero: loteSel.genero || 'todos',
              loteIncluyeConsumicion: !!loteSel.incluyeConsumicion,
            })
            idsGeneradas.push(ref.id)
          }

          await cargarEntradasUsuario(usuarioId)

          if (cantidadFree === 1) {
            mostrarQrReact({
              ticketId: idsGeneradas[0],
              nombreEvento: e.nombre,
              fecha: e.fecha,
              lugar: e.lugar,
              horario: e.horario ?? 'A confirmar',
              precio: 'Entrada gratuita',
            })
            return
          }

          return Swal.fire({
            title: 'Entradas generadas ✔',
            html: `
              <p>Se crearon <strong>${cantidadFree}</strong> entradas gratuitas.</p>
              <p>Puedes verlas en <strong>Mis Entradas</strong>.</p>
            `,
            icon: 'success',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        // --------------------------------------------------
        // Lote de PAGO → cantidad + método
        // --------------------------------------------------
        const { value: metodo, isDenied } = await Swal.fire({
          title: `${e.nombre} — ${loteSel.nombre || 'Lote'}`,
          html: `
            <p>Valor de entrada: <strong>$${precioLote}</strong></p>
            <label for="swal-cant">Cantidad (máx ${maxLoteUsuario}):</label>
            <input id="swal-cant" type="number" class="swal2-input"
                   min="1" max="${maxLoteUsuario}" value="1">
          `,
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'Mercado Pago',
          denyButtonText: 'Transferencia',
          cancelButtonText: 'Salir',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'btn btn-success',
            denyButton: 'btn btn-dark',
            cancelButton: 'btn btn-secondary',
          },
          ...swalEstiloBase(),
        })

        if (!metodo && !isDenied) return

        const cantidadSel =
          parseInt(document.getElementById('swal-cant').value, 10) || 1

        if (cantidadSel > maxLoteUsuario) {
          return Swal.fire({
            icon: 'warning',
            title: 'Límite superado',
            text: `Solo puedes solicitar ${maxLoteUsuario} entradas para este lote.`,
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        const entradaBase = {
          nombre: e.nombre,
          precio: precioLote,
          fecha: e.fecha,
          lugar: e.lugar,
          horario: e.horario || 'A confirmar',
          cantidad: cantidadSel,
          loteIndice: loteSel.index,
          loteNombre: loteSel.nombre || null,
          loteGenero: loteSel.genero || 'todos',
          loteIncluyeConsumicion: !!loteSel.incluyeConsumicion,
        }

        // 🔹 TRANSFERENCIA
        if (isDenied) {
          const datos = await obtenerDatosBancarios()
          const contacto = await obtenerContacto()

          const cuentaBancaria = `
Banco: ${datos.nombreBanco || ''}
CBU: ${datos.cbuBanco || ''}
Alias: ${datos.aliasBanco || ''}
Titular: ${datos.titularBanco || ''}
          `.trim()

          const result = await Swal.fire({
            title: 'Transferencia bancaria',
            html: `
              <p>Realiza la transferencia y luego envía el comprobante.</p>
              <pre style="text-align:left;background:#222;padding:8px;border-radius:8px;color:white;">
${cuentaBancaria}
              </pre>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Enviar comprobante por WhatsApp',
            denyButtonText: 'Copiar datos',
            cancelButtonText: 'Cancelar orden',
            buttonsStyling: false,
            customClass: {
              confirmButton: 'btn btn-success',
              denyButton: 'btn btn-dark',
              cancelButton: 'btn btn-secondary',
            },
            ...swalEstiloBase(),
          })

          if (result.isDenied) {
            await navigator.clipboard.writeText(cuentaBancaria)
            await Swal.fire({
              title: 'Datos copiados ✔️',
              confirmButtonText: 'Ok',
              buttonsStyling: false,
              customClass: { confirmButton: 'btn btn-dark' },
              ...swalEstiloBase(),
            })
          }

          if (result.isConfirmed) {
            if (contacto?.whatsappContacto) {
              const mensaje = encodeURIComponent(
                `Hola, soy ${usuarioNombre}. Solicité ${cantidadSel} entrada(s) del evento "${
                  e.nombre
                }" (${loteSel.nombre || 'sin lote'}).`
              )
              window.open(
                `https://wa.me/${contacto.whatsappContacto}?text=${mensaje}`,
                '_blank'
              )
            }

            await crearSolicitudPendiente(eventoId, usuarioId, entradaBase)

            return Swal.fire({
              title: 'Solicitud enviada',
              text: 'Puedes enviar el comprobante ahora.',
              icon: 'success',
              buttonsStyling: false,
              customClass: { confirmButton: 'btn btn-dark' },
              ...swalEstiloBase(),
            })
          }

          return
        }

        // 🔹 MERCADO PAGO
        const initPoint = await crearPreferenciaEntrada({
          usuarioId,
          eventoId,
          nombreEvento: e.nombre,
          cantidad: cantidadSel,
          precio: precioLote,
          imagenEventoUrl: e.imagenEventoUrl || e.imagen,
          loteIndice: loteSel.index,
          loteNombre: loteSel.nombre || null,
        })

        if (!initPoint) {
          return Swal.fire('Error', 'No se pudo iniciar el pago.', 'error')
        }

        window.location.href = initPoint
        return
      }

      // ======================================================
      //  CASO B: EVENTO SIN LOTES (LÓGICA ORIGINAL)
      // ======================================================
      const maxFinal = maxPorUsuarioEvento

      // Evento gratuito
      if (!eventoData.precio || eventoData.precio < 1) {
        const { value: cantidad } = await Swal.fire({
          title: e.nombre,
          html: `
            <p>Entrada gratuita ✔</p>
            <label for="swal-cant-free">Cantidad (máx ${maxFinal}):</label>
            <input id="swal-cant-free" type="number" class="swal2-input"
                   min="1" max="${maxFinal}" value="1">
          `,
          confirmButtonText: 'Solicitar',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'btn btn-success',
            cancelButton: 'btn btn-dark',
          },
          ...swalEstiloBase(),
          preConfirm: () =>
            parseInt(document.getElementById('swal-cant-free').value, 10) || 1,
        })

        if (!cantidad) return

        if (cantidad > maxFinal) {
          return Swal.fire({
            icon: 'warning',
            title: 'Límite superado',
            text: `Solo puedes solicitar ${maxFinal} entradas.`,
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        const idsGeneradas = []

        for (let i = 0; i < cantidad; i++) {
          const ref = await addDoc(collection(db, 'entradas'), {
            eventoId,
            usuarioId,
            usuarioNombre,
            fecha: e.fecha,
            lugar: e.lugar,
            nombreEvento: e.nombre,
            pagado: true,
            precio: 0,
            cantidad: 1,
            creadoEn: new Date().toISOString(),
            usado: false,
            estado: 'aprobada',
          })
          idsGeneradas.push(ref.id)
        }

        await cargarEntradasUsuario(usuarioId)

        if (cantidad === 1) {
          mostrarQrReact({
            ticketId: idsGeneradas[0],
            nombreEvento: e.nombre,
            fecha: e.fecha,
            lugar: e.lugar,
            horario: e.horario ?? 'A confirmar',
            precio: 'Entrada gratuita',
          })
          return
        }

        return Swal.fire({
          title: 'Entradas generadas ✔',
          html: `
            <p>Se crearon <strong>${cantidad}</strong> entradas gratuitas.</p>
            <p>Puedes verlas en <strong>Mis Entradas</strong>.</p>
          `,
          icon: 'success',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-dark' },
          ...swalEstiloBase(),
        })
      }

      // Evento de pago (sin lotes)
      const { value: metodo, isDenied } = await Swal.fire({
        title: e.nombre,
        html: `
          <p>Valor de entrada: <strong>$${e.precio}</strong></p>
          <label for="swal-cant">Cantidad (máx ${maxFinal}):</label>
          <input id="swal-cant" type="number" class="swal2-input"
                 min="1" max="${maxFinal}" value="1">
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Mercado Pago',
        denyButtonText: 'Transferencia',
        cancelButtonText: 'Salir',
        buttonsStyling: false,
        customClass: {
          confirmButton: 'btn btn-success',
          denyButton: 'btn btn-dark',
          cancelButton: 'btn btn-secondary',
        },
        ...swalEstiloBase(),
      })

      if (!metodo && !isDenied) return

      const cantidad =
        parseInt(document.getElementById('swal-cant').value, 10) || 1

      if (cantidad > maxFinal) {
        return Swal.fire({
          icon: 'warning',
          title: 'Límite superado',
          text: `Solo puedes solicitar ${maxFinal} entradas.`,
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-dark' },
          ...swalEstiloBase(),
        })
      }

      const entradaBase = {
        nombre: e.nombre,
        precio: Number(e.precio),
        fecha: e.fecha,
        lugar: e.lugar,
        horario: e.horario || 'A confirmar',
        cantidad,
      }

      // Transferencia (sin lotes)
      if (isDenied) {
        const datos = await obtenerDatosBancarios()
        const contacto = await obtenerContacto()

        const cuentaBancaria = `
Banco: ${datos.nombreBanco || ''}
CBU: ${datos.cbuBanco || ''}
Alias: ${datos.aliasBanco || ''}
Titular: ${datos.titularBanco || ''}
        `.trim()

        const result = await Swal.fire({
          title: 'Transferencia bancaria',
          html: `
            <p>Realiza la transferencia y luego envia el comprobante.</p>
            <pre style="text-align:left;background:#222;padding:8px;border-radius:8px;color:white;">
${cuentaBancaria}
            </pre>
          `,
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'Enviar comprobante por WhatsApp',
          denyButtonText: 'Copiar datos',
          cancelButtonText: 'Cancelar orden',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'btn btn-success',
            denyButton: 'btn btn-dark',
            cancelButton: 'btn btn-secondary',
          },
          ...swalEstiloBase(),
        })

        if (result.isDenied) {
          await navigator.clipboard.writeText(cuentaBancaria)
          await Swal.fire({
            title: 'Datos copiados ✔️',
            confirmButtonText: 'Ok',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        if (result.isConfirmed) {
          if (contacto?.whatsappContacto) {
            const mensaje = encodeURIComponent(
              `Hola, soy ${usuarioNombre}. Solicité ${cantidad} entrada(s) del evento "${e.nombre}".`
            )
            window.open(
              `https://wa.me/${contacto.whatsappContacto}?text=${mensaje}`,
              '_blank'
            )
          }

          await crearSolicitudPendiente(eventoId, usuarioId, entradaBase)

          return Swal.fire({
            title: 'Solicitud enviada',
            text: 'Puedes enviar el comprobante ahora.',
            icon: 'success',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-dark' },
            ...swalEstiloBase(),
          })
        }

        return
      }

      // Mercado Pago (sin lotes)
      const initPoint = await crearPreferenciaEntrada({
        usuarioId,
        eventoId,
        nombreEvento: e.nombre,
        cantidad,
        precio: e.precio,
        imagenEventoUrl: e.imagenEventoUrl || e.imagen,
      })

      if (!initPoint) {
        return Swal.fire('Error', 'No se pudo iniciar el pago.', 'error')
      }

      window.location.href = initPoint
    } catch (err) {
      console.error('❌ Error en pedirEntrada:', err)
      Swal.fire('Error', 'Ocurrió un error procesando la entrada.', 'error')
    }
  }

  // ------------------------------------------------------
  // Provider
  // ------------------------------------------------------
  return (
    <EntradasContext.Provider
      value={{
        eventos,
        loadingEventos,
        pedirEntrada,
        misEntradas,
        entradasPendientes,
        entradasUsadas,
        historial,
      }}
    >
      {children}
    </EntradasContext.Provider>
  )
}
