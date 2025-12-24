import { useEffect, useRef } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import Swal from 'sweetalert2'
import { db } from '../Firebase'
import { useFirebase } from '../context/FirebaseContext'

export default function NotificacionesListener() {
  const { user, isAdmin } = useFirebase()
  const procesadasRef = useRef(new Set())

  useEffect(() => {
    if (!user || isAdmin) return

    const q = query(
      collection(db, 'notificaciones'),
      where('usuarioId', '==', user.uid),
      where('visto', '==', false),
      orderBy('creadoEn', 'desc')
    )

    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(async change => {
        if (change.type !== 'added') return

        const id = change.doc.id
        if (procesadasRef.current.has(id)) return
        procesadasRef.current.add(id)

        const n = change.doc.data()
        if (n.tipo !== 'entrada_aprobada') return

        // 🔒 marcar visto primero
        await updateDoc(doc(db, 'notificaciones', id), {
          visto: true,
          vistoEn: serverTimestamp(),
        })

        Swal.fire({
          icon: 'success',
          title: '🎉 Entradas disponibles',
          html: `<b>${n.nombreEvento}</b><br/>Tus entradas ya están listas.`,
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        })
      })
    })

    return () => unsub()
  }, [user?.uid, isAdmin])

  return null
}
