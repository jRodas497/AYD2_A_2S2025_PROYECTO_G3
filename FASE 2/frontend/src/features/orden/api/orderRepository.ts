import type { CrearOrdenInput, EstadoOrden, Order } from '../types'

export interface OrderRepository {
  createOrder(input: CrearOrdenInput): Promise<Order>
  getOrder(id: string): Promise<Order | null>
  updateEstado(id: string, estado: EstadoOrden): Promise<Order | null>
}
