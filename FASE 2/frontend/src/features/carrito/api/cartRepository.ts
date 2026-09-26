import type { Cart } from '../types'

export interface CartRepository {
  getCart(customerId: string): Promise<Cart>
  addItem(customerId: string, productId: string, cantidad: number): Promise<Cart>
}
