import { useEffect, useState } from 'react'
import { db } from '../../Firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function RedesSociales() {
  const [redes, setRedes] = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracion', 'social'))
        if (snap.exists()) setRedes(snap.data())
      } catch (err) {
        console.error('Error cargando redes sociales:', err)
      }
    }

    cargar()
  }, [])

  if (!redes) return <p className="text-muted">Cargando redes...</p>

  const botones = []

  if (redes.toggleWhatsapp && redes.whatsappContacto)
    botones.push({
      label: 'WhatsApp',
      url: `https://wa.me/${redes.whatsappContacto}`,
      class: 'btn-outline-success',
    })

  if (redes.toggleInstagram && redes.instagramContacto)
    botones.push({
      label: 'Instagram',
      url: `https://instagram.com/${redes.instagramContacto.replace('@', '')}`,
      class: 'btn-outline-dark',
    })

  if (redes.toggleTiktok && redes.tiktokContacto)
    botones.push({
      label: 'TikTok',
      url: `https://tiktok.com/@${redes.tiktokContacto.replace('@', '')}`,
      class: 'btn-outline-dark',
    })

  if (redes.toggleX && redes.xContacto)
    botones.push({
      label: 'X',
      url: `https://x.com/${redes.xContacto.replace('@', '')}`,
      class: 'btn-outline-dark',
    })

  if (redes.toggleFacebook && redes.facebookContacto)
    botones.push({
      label: 'Facebook',
      url: `https://facebook.com/${redes.facebookContacto}`,
      class: 'btn-outline-primary',
    })

  if (redes.toggleWeb && redes.webContacto)
    botones.push({
      label: 'Página web',
      url: `https://${redes.webContacto}`,
      class: 'btn-outline-dark',
    })

  if (botones.length === 0)
    return <p className="text-muted">No hay redes activas.</p>

  return (
    <div className="d-grid gap-2">
      {botones.map((b, i) => (
        <button
          key={i}
          className={`btn ${b.class}`}
          onClick={() => window.open(b.url, '_blank')}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
