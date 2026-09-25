import type { PaymentRepository } from './paymentRepository'
import type { DatosTarjeta, MetodoPago, PaymentAttempt, ResultadoCobro } from '../types'
import { manejarRespuesta } from '../../../shared/api/httpErrors'

const MAX_INTENTOS_FALLIDOS = 3

const MAPA_METODO: Record<MetodoPago, string> = {
  tarjeta: 'CARD',
  transferencia: 'TRANSFER',
  billetera: 'WALLET',
}

const MAPA_RESULTADO: Record<string, ResultadoCobro> = {
  APPROVED: 'aprobado',
  DECLINED: 'rechazado',
  TIMEOUT: 'en_proceso',
  ERROR: 'en_proceso',
}

interface BackendChargeResponse {
  orderId: number
  attemptNumber: number
  result: string
  orderStatus: string
  providerReference: string | null
  latencyMs: number
  message: string
}

interface BackendPaymentAttempt {
  id: number
  attemptNumber: number
  result: string
  amount: number
  providerReference: string | null
  cardLast4: string | null
  failureReason: string | null
  latencyMs: number
  attemptedAt: string
}

function generarTokenSimulado(): string {
  // No existe un widget real de PayKlik en este entorno de demo: se simula el límite que tendría
  // uno real, que nunca entrega el número de tarjeta al comercio, solo un token opaco. El backend
  // rechaza con 400 cualquier valor que parezca un número de tarjeta.
  return `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export const httpPaymentRepository: PaymentRepository = {
  maxIntentosFallidos: MAX_INTENTOS_FALLIDOS,

  async charge(orderId, metodo: MetodoPago, tarjeta?: DatosTarjeta) {
    const respuesta = await manejarRespuesta<BackendChargeResponse>(
      await fetch(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: MAPA_METODO[metodo],
          cardToken: generarTokenSimulado(),
          cardLast4: tarjeta?.ultimosDigitos,
        }),
      }),
    )
    const resultado = MAPA_RESULTADO[respuesta.result] ?? 'en_proceso'
    const intento: PaymentAttempt = {
      id: `${respuesta.orderId}-${respuesta.attemptNumber}`,
      orderId,
      metodo,
      resultado,
      motivo: resultado !== 'aprobado' ? respuesta.message : undefined,
      fecha: new Date().toISOString(),
    }
    return intento
  },

  async countIntentosFallidos(orderId) {
    const intentos = await manejarRespuesta<BackendPaymentAttempt[]>(await fetch(`/api/orders/${orderId}/payments`))
    return intentos.filter((i) => i.result === 'DECLINED').length
  },
}
