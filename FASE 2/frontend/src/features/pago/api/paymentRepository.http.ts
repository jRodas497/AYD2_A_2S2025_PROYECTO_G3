import { apiFetch as fetch } from '../../../shared/api/apiFetch'
import type { PaymentRepository } from './paymentRepository'
import type { DatosTarjeta, MetodoPago, PaymentAttempt, ResultadoCobro } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'
import { generarTokenSimulado } from '../../../shared/api/paymentToken'

const MAX_INTENTOS_FALLIDOS = 3

const MAPA_METODO: Record<MetodoPago, string> = {
  tarjeta: 'CARD',
  transferencia: 'TRANSFER',
  billetera: 'WALLET',
  credito: 'CREDIT',
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
    try {
      const intentos = await manejarRespuesta<BackendPaymentAttempt[]>(await fetch(`/api/orders/${orderId}/payments`))
      return intentos.filter((i) => i.result === 'DECLINED').length
    } catch (e) {
      if (e instanceof NotFoundError) return 0
      throw e
    }
  },
}
