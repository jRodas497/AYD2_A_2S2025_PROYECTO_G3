import type { CartItem } from '../carrito/types'

export type EstadoOrden =
  | 'pendiente_pago'
  | 'pago_en_proceso'
  | 'pago_fallido'
  | 'pagada'
  | 'facturada'
  | 'en_despacho'
  | 'entregada'
  | 'cancelada'
  | 'devuelta'

export interface Order {
  id: string
  customerId: string
  items: CartItem[]
  total: number
  direccionEntrega: string
  estado: EstadoOrden
  creadaEn: string
  enProcesoDesde?: string
  trackingNumber?: string
}

export interface CrearOrdenInput {
  customerId: string
  items: CartItem[]
  direccionEntrega: string
}
