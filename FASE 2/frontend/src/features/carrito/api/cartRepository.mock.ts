import type { CartRepository } from './cartRepository'
import { mockCatalogRepository } from '../../catalogo/api/catalogRepository.mock'
import { EMPTY_CART, type Cart, type CartItem } from '../types'

const LATENCIA_MS = 150

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function claveDe(customerId: string): string {
  return `sgo-cart-${customerId}`
}

function cargarCarrito(customerId: string): Cart {
  const crudo = localStorage.getItem(claveDe(customerId))
  if (!crudo) return EMPTY_CART
  try {
    return JSON.parse(crudo) as Cart
  } catch {
    return EMPTY_CART
  }
}

function guardarCarrito(customerId: string, cart: Cart): void {
  localStorage.setItem(claveDe(customerId), JSON.stringify(cart))
}

export const mockCartRepository = {
  async getCart(customerId: string) {
    return esperar(cargarCarrito(customerId))
  },

  async addItem(customerId: string, productId: string, cantidad: number) {
    const cart = cargarCarrito(customerId)
    const items: CartItem[] = cart.items.map((item) => ({ ...item }))
    const existente = items.find((i) => i.productId === productId)
    if (existente) {
      existente.cantidad += cantidad
    } else {
      const producto = await mockCatalogRepository.getById(productId)
      items.push({
        productId,
        nombre: producto?.nombre ?? '',
        sku: producto?.sku ?? '',
        cantidad,
        precioUnitario: producto?.precio.final ?? 0,
      })
    }
    const nuevoCart = { items }
    guardarCarrito(customerId, nuevoCart)
    return esperar(nuevoCart)
  },

  async setQuantity(customerId: string, productId: string, cantidad: number) {
    const cart = cargarCarrito(customerId)
    const items = cart.items.map((item) => (item.productId === productId ? { ...item, cantidad } : item))
    const nuevoCart = { items }
    guardarCarrito(customerId, nuevoCart)
    return esperar(nuevoCart)
  },

  async removeItem(customerId: string, productId: string) {
    const cart = cargarCarrito(customerId)
    const nuevoCart = { items: cart.items.filter((item) => item.productId !== productId) }
    guardarCarrito(customerId, nuevoCart)
    return esperar(nuevoCart)
  },
} satisfies CartRepository
