function claveDe(customerId: string): string {
  return `sgo-order-ids-${customerId}`
}

export function registrarOrden(customerId: string, orderId: string): void {
  const ids = listarIdsOrdenes(customerId)
  if (ids.includes(orderId)) return
  ids.push(orderId)
  localStorage.setItem(claveDe(customerId), JSON.stringify(ids))
}

export function listarIdsOrdenes(customerId: string): string[] {
  const crudo = localStorage.getItem(claveDe(customerId))
  if (!crudo) return []
  try {
    const valor = JSON.parse(crudo)
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}
