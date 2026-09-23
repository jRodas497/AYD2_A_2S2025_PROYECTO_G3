import type { CrearOrdenInput, Order } from '../types'

export interface OrderRepository {
  createOrder(input: CrearOrdenInput): Promise<Order>
  getOrder(id: string): Promise<Order | null>
}
