import { db } from '../Firebase'
import { doc, getDoc } from 'firebase/firestore'

export async function validarStockCarrito(carrito) {
  const errores = []

  for (const item of carrito) {
    const ref = doc(db, 'productos', item.id)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      errores.push(`El producto "${item.nombre}" ya no existe`)
      continue
    }

    const stockActual = Number(snap.data().stock ?? 0)
    if (stockActual < item.enCarrito) {
      errores.push(
        `<strong>${item.nombre}:</strong> Disponibles: <strong>${stockActual}</strong> / Pedidos: <strong>${item.enCarrito}</strong>`
      )
    }
  }

  return errores
}
