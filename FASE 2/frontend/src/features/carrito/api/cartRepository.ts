import type { Cart } from '../types'

export interface CartRepository {
  getCart(customerId: string): Promise<Cart>
  saveCart(customerId: string, cart: Cart): Promise<void>
}
