import { db, doc, updateDoc } from 'firebase/firestore'
if (esValido) {
  await updateDoc(doc(db, 'entradas', ticketId), {
    estado: 'validada',
    validadoEn: new Date().toISOString(),
  })

  setResultado('OK')
}
