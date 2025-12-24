export async function triggerLimpiezaPagos() {
  if (import.meta.env.DEV) return
  try {
    await fetch('/api/limpiar-pagos-pendientes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_CRON_SECRET}`,
      },
    })
  } catch (err) {
    console.warn('⚠️ Limpieza pagos no ejecutada', err)
  }
}
