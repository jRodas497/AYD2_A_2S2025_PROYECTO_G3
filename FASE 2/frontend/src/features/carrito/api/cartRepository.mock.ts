import type { CartRepository } from './cartRepository'
import { EMPTY_CART, type Cart } from '../types'

const LATENCIA_MS = 150

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function claveDe(customerId: string): string {
  return `sgo-cart-${customerId}`
}

export const mockCartRepository: CartRepository = {
  async getCart(customerId) {
    const crudo = localStorage.getItem(claveDe(customerId))
    if (!crudo) return esperar(EMPTY_CART)
    try {
      return esperar(JSON.parse(crudo) as Cart)
    } catch {
      return esperar(EMPTY_CART)
    }
  },
  async saveCart(customerId, cart) {
    localStorage.setItem(claveDe(customerId), JSON.stringify(cart))
    return esperar(undefined)
  },
}
