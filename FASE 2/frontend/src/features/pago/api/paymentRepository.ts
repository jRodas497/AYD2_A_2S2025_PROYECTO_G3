import type { DatosTarjeta, MetodoPago, PaymentAttempt } from '../types'

export interface PaymentRepository {
  charge(orderId: string, metodo: MetodoPago, tarjeta?: DatosTarjeta): Promise<PaymentAttempt>
  countIntentosFallidos(orderId: string): Promise<number>
  readonly maxIntentosFallidos: number
}
