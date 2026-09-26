export type MetodoPago = 'tarjeta' | 'transferencia' | 'billetera'

export type ResultadoCobro = 'aprobado' | 'en_proceso' | 'rechazado'

export interface PaymentAttempt {
  id: string
  orderId: string
  metodo: MetodoPago
  resultado: ResultadoCobro
  motivo?: string
  fecha: string
}

export interface DatosTarjeta {
  ultimosDigitos: string
}
