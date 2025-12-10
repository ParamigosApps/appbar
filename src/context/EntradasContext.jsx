// --------------------------------------------------------------
// src/context/EntradasContext.jsx — VERSIÓN FINAL MODULAR
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

// 🔥 IMPORTAMOS LA LÓGICA MODULAR
import {
  calcularCuposEvento,
  prepararLotes,
} from '../logic/entradas/entradasEventos.js'
import {
  pedirEntradaFreeSinLote,
  pedirEntradaFreeConLote,
} from '../logic/entradas/entradasGratis.js'
import {
  manejarTransferencia,
  manejarMercadoPago,
} from '../logic/entradas/entradasPago.js'
import {
  obtenerDatosBancarios,
  obtenerContacto,
  crearSolicitudPendiente,
} from '../logic/entradas/entradasUtils.js'

import Swal from 'sweetalert2'

const EntradasContext = createContext()
export const useEntradas = () => useContext(EntradasContext)

export function EntradasProvider({ children }) {
  const { user } = useFirebase()
  const { abrirLoginGlobal } = useAuth()
  const { mostrarQrReact } = useQr()

  const [eventos, setEventos] = useState([])
  const [misEntradas, setMisEntradas] = useState([])
  const [entradasPendientes, setEntradasPendientes] = useState([])
  const [entradasUsadas] = useState([])
  const [loadingEventos, setLoadingEventos] = useState(true)

  // ============================================================
  // MODALES — SE MANTIENEN IGUAL
  // ============================================================
  const [modalSeleccion, setModalSeleccion] = useState({
    visible: false,
    lotes: [],
    evento: null,
    onSelect: null,
    onClose: null,
  })

  function abrirModalSeleccionLote(lotes, evento) {
    return new Promise(resolve => {
      setModalSeleccion({
        visible: true,
        lotes,
        evento,
        onSelect: index => {
          setModalSeleccion(p => ({ ...p, visible: false }))
          resolve(index)
        },
        onClose: () => {
          setModalSeleccion(p => ({ ...p, visible: false }))
          resolve(null)
        },
      })
    })
  }

  const [modalPago, setModalPago] = useState({
    visible: false,
    evento: null,
    lote: null,
    precio: 0,
    maxCantidad: 1,
    onResult: () => {},
  })

  function abrirModalMetodoPago({ evento, precio, loteSel, maxCantidad }) {
    return new Promise(resolve => {
      setModalPago({
        visible: true,
        evento,
        lote: loteSel,
        precio,
        maxCantidad: maxCantidad || 1,
        onResult: result => {
          setModalPago(p => ({ ...p, visible: false }))
          resolve(result)
        },
      })
    })
  }

  // ============================================================
  // CARGAR EVENTOS
  // ============================================================
  useEffect(() => {
    async function cargar() {
      setLoadingEventos(true)
      try {
        const snap = await getDocs(collection(db, 'eventos'))
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        arr.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        setEventos(arr)
      } catch (e) {
        console.error('Error cargando eventos:', e)
      }
      setLoadingEventos(false)
    }
    cargar()
  }, [])

  // ============================================================
  // MIS ENTRADAS
  // ============================================================
  useEffect(() => {
    if (!user) return setMisEntradas([])
    cargarEntradasUsuario(user.uid)
  }, [user])

  async function cargarEntradasUsuario(uid) {
    const q = query(collection(db, 'entradas'), where('usuarioId', '==', uid))
    const snap = await getDocs(q)
    setMisEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  // ============================================================
  // PENDIENTES EN TIEMPO REAL
  // ============================================================
  useEffect(() => {
    if (!user) return setEntradasPendientes([])

    const q = query(
      collection(db, 'entradasPendientes'),
      where('usuarioId', '==', user.uid)
    )

    const unsub = onSnapshot(q, snap =>
      setEntradasPendientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    return () => unsub()
  }, [user])

  // ============================================================
  // FUNCIÓN PRINCIPAL: PEDIR ENTRADA
  // ============================================================
  async function pedirEntrada(evento) {
    try {
      if (!user) {
        await Swal.fire({
          title: 'Debes iniciar sesión',
          icon: 'warning',
          confirmButtonText: 'Iniciar sesión',
        })
        abrirLoginGlobal()
        return
      }

      const usuarioId = user.uid
      const usuarioNombre = user.displayName || 'Usuario'

      // ========================================================
      // OBTENER CUPOS / LOTES (usando módulos)
      // ========================================================
      const { eventoData, cupoRestante, maxUser, lotesInfo } =
        await calcularCuposEvento(evento.id, usuarioId)

      // Evento con lotes
      if (lotesInfo.length > 0) {
        const indice = await abrirModalSeleccionLote(lotesInfo, evento)
        if (indice === null) return

        const loteSel = lotesInfo.find(x => x.index === indice)
        const precio = Number(loteSel.precio)

        if (precio <= 0) {
          return pedirEntradaFreeConLote({
            evento,
            loteSel,
            usuarioId,
            usuarioNombre,
            mostrarQrReact,
            cargarEntradasUsuario,
          })
        }

        const result = await abrirModalMetodoPago({
          evento,
          precio,
          loteSel,
          maxCantidad: Math.min(maxUser, loteSel.restantes),
        })

        if (!result) return

        if (result.metodo === 'transfer') {
          return manejarTransferencia({
            evento,
            precio,
            cantidadSel: result.cantidad,
            loteSel,
            usuarioId,
            usuarioNombre,
            eventoId: evento.id,
            crearSolicitudPendiente,
          })
        }

        if (result.metodo === 'mp') {
          return manejarMercadoPago({
            evento,
            precio,
            cantidadSel: result.cantidad,
            usuarioId,
            eventoId: evento.id,
          })
        }

        return
      }

      // ========================================================
      // Evento sin lotes — FREE
      // ========================================================
      const precioEvento = Number(eventoData.precio || 0)
      if (precioEvento <= 0) {
        return pedirEntradaFreeSinLote({
          evento,
          usuarioId,
          usuarioNombre,
          maxUser,
          mostrarQrReact,
          cargarEntradasUsuario,
        })
      }

      // ========================================================
      // Evento sin lotes — PAGO
      // ========================================================
      const resultPago = await abrirModalMetodoPago({
        evento,
        precio: precioEvento,
        loteSel: null,
        maxCantidad: maxUser,
      })

      if (!resultPago) return

      if (resultPago.metodo === 'transfer') {
        return manejarTransferencia({
          evento,
          precio: precioEvento,
          cantidadSel: resultPago.cantidad,
          usuarioId,
          usuarioNombre,
          eventoId: evento.id,
          crearSolicitudPendiente,
        })
      }

      if (resultPago.metodo === 'mp') {
        return manejarMercadoPago({
          evento,
          precio: precioEvento,
          cantidadSel: resultPago.cantidad,
          usuarioId,
          eventoId: evento.id,
        })
      }
    } catch (err) {
      console.error('ERROR pedirEntrada:', err)
      Swal.fire('Error', 'Ocurrió un problema inesperado.', 'error')
    }
  }

  // ============================================================
  // PROVIDER
  // ============================================================
  return (
    <EntradasContext.Provider
      value={{
        eventos,
        loadingEventos,
        pedirEntrada,
        misEntradas,
        entradasPendientes,
        entradasUsadas,

        modalSeleccion,
        modalPago,
      }}
    >
      {children}
    </EntradasContext.Provider>
  )
}
