// --------------------------------------------------------------
// src/context/PedidosContext.jsx — VERSIÓN FINAL + REAL-TIME
// --------------------------------------------------------------
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react'

import {
  collection,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  increment,
  onSnapshot,
} from 'firebase/firestore'

import { db } from '../Firebase.js'
import { useFirebase } from './FirebaseContext.jsx'
import { mostrarMensaje } from '../utils/utils.js'

const PedidosContext = createContext()
export const usePedidos = () => useContext(PedidosContext)

// --------------------------------------------------------------
// 🔁 DEVOLVER STOCK
// --------------------------------------------------------------
async function devolverStock(items = []) {
  if (!Array.isArray(items)) return

  try {
    for (const item of items) {
      const prodId = item.productoId || item.id
      const cantidad = Number(item.cantidad || item.enCarrito) || 0

      if (!prodId || !cantidad) continue

      await updateDoc(doc(db, 'productos', prodId), {
        stock: increment(cantidad),
      })
    }
  } catch (err) {
    console.error('❌ Error devolviendo stock:', err)
  }
}

// --------------------------------------------------------------
// PROVIDER
// --------------------------------------------------------------
export function PedidosProvider({ children }) {
  const { user } = useFirebase()

  const [pedidosPendientes, setPedidosPendientes] = useState([])
  const [pedidosPagados, setPedidosPagados] = useState([])
  const [pedidosRetirados, setPedidosRetirados] = useState([])
  const [loadingPedidos, setLoadingPedidos] = useState(false)

  const [abiertos, setAbiertos] = useState({
    pagados: false,
    pendientes: false,
    retirados: false,
  })

  const expiradosRef = useRef(new Set())
  const timersRef = useRef({})

  const limpiarTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(t => clearTimeout(t))
    timersRef.current = {}
  }, [])

  // --------------------------------------------------------------
  // ⏳ EXPIRACIÓN AUTOMÁTICA
  // --------------------------------------------------------------
  const procesarExpiracion = useCallback(async pedido => {
    if (!pedido?.id) return
    const id = pedido.id

    if (expiradosRef.current.has(id)) return
    expiradosRef.current.add(id)

    try {
      await devolverStock(pedido.items)
      await deleteDoc(doc(db, 'compras', id))

      setPedidosPendientes(prev => prev.filter(p => p.id !== id))

      mostrarMensaje('⚠ Caducó 1 pedido pendiente.', '#c40b1d', '#fff')
    } catch (err) {
      console.error('❌ Error al expirar pedido:', err)
    }
  }, [])

  // --------------------------------------------------------------
  // 🕒 PROGRAMAR EXPIRACIONES
  // --------------------------------------------------------------
  const programarExpiraciones = useCallback(
    pendientes => {
      limpiarTimers()

      const ahora = Date.now()

      pendientes.forEach(pedido => {
        let base =
          pedido.creadoEn?.toDate?.() ??
          pedido.fecha?.toDate?.() ??
          new Date(pedido.fecha)

        if (!base || isNaN(base.getTime())) return

        const expiraEn = base.getTime() + 15 * 60 * 1000
        const diff = expiraEn - ahora

        if (diff <= 0) procesarExpiracion(pedido)
        else {
          timersRef.current[pedido.id] = setTimeout(
            () => procesarExpiracion(pedido),
            diff
          )
        }
      })
    },
    [limpiarTimers, procesarExpiracion]
  )

  // --------------------------------------------------------------
  // 🔄 LISTENER EN TIEMPO REAL
  // --------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setPedidosPendientes([])
      setPedidosPagados([])
      setPedidosRetirados([])
      limpiarTimers()
      return
    }

    const q = query(
      collection(db, 'compras'),
      where('usuarioId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(q, snap => {
      const pedidos = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }))

      pedidos.sort((a, b) => {
        const fa =
          a.fecha?.toDate?.() ?? a.creadoEn?.toDate?.() ?? new Date(a.fecha)
        const fb =
          b.fecha?.toDate?.() ?? b.creadoEn?.toDate?.() ?? new Date(b.fecha)
        return fb - fa
      })

      const pendientes = pedidos.filter(p => p.estado === 'pendiente')
      const pagados = pedidos.filter(p => p.estado === 'pagado')
      const retirados = pedidos.filter(p => p.estado === 'retirado')

      setPedidosPendientes(pendientes)
      setPedidosPagados(pagados)
      setPedidosRetirados(retirados)

      programarExpiraciones(pendientes)
    })

    return unsubscribe
  }, [user, programarExpiraciones, limpiarTimers])

  useEffect(() => () => limpiarTimers(), [limpiarTimers])

  // --------------------------------------------------------------
  // 🔵 abrirPendientes() — para cuando ve el QR
  // --------------------------------------------------------------
  const abrirPendientes = () => {
    setAbiertos({
      pagados: false,
      pendientes: true,
      retirados: false,
    })

    setTimeout(() => {
      const el = document.getElementById('container-pedidos')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  // --------------------------------------------------------------
  // VALUE
  // --------------------------------------------------------------
  const value = {
    pedidosPendientes,
    pedidosPagados,
    pedidosRetirados,
    loadingPedidos,

    eliminarPedido: async pedido => {
      if (pedido.estado === 'pendiente') await devolverStock(pedido.items)
      await deleteDoc(doc(db, 'compras', pedido.id))
    },

    procesarExpiracion,
    abiertos,
    setAbiertos,
    abrirPendientes,
  }

  return (
    <PedidosContext.Provider value={value}>{children}</PedidosContext.Provider>
  )
}
