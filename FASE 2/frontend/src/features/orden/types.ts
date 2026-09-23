import type { CartItem } from '../carrito/types'

export type MetodoEntrega = 'centro_distribucion' | 'tienda' | 'recogida'

export type EstadoOrden = 'pendiente_pago' | 'pagada' | 'pago_fallido'

export interface Order {
  id: string
  customerId: string
  items: CartItem[]
  total: number
  metodoEntrega: MetodoEntrega
  estado: EstadoOrden
  creadaEn: string
}

export interface CrearOrdenInput {
  customerId: string
  items: CartItem[]
  metodoEntrega: MetodoEntrega
}
