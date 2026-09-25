import type { CartItem } from '../carrito/types'

export interface OrderSnapshot {
  items: CartItem[]
  direccionEntrega: string
}

function claveDe(orderId: string): string {
  return `sgo-order-items-${orderId}`
}

export function guardarSnapshot(orderId: string, snapshot: OrderSnapshot): void {
  localStorage.setItem(claveDe(orderId), JSON.stringify(snapshot))
}

export function obtenerSnapshot(orderId: string): OrderSnapshot | null {
  const crudo = localStorage.getItem(claveDe(orderId))
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as OrderSnapshot
  } catch {
    return null
  }
}
