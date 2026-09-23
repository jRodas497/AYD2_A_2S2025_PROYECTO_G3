import type { PaymentRepository } from './paymentRepository'
import type { PaymentAttempt, ResultadoCobro } from '../types'
import { mockOrderRepository } from '../../orden/api/orderRepository.mock'

const LATENCIA_MS = 200
const RESOLUCION_EN_PROCESO_MS = 4000
const MAX_INTENTOS_FALLIDOS = 3

const TARJETA_RECHAZADA = '0000'
const TARJETA_EN_PROCESO = '1111'

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const INTENTOS: PaymentAttempt[] = []
let siguienteNumero = 1

function generarIntentoId(): string {
  const id = `PAY-${String(siguienteNumero).padStart(6, '0')}`
  siguienteNumero += 1
  return id
}

function resolverResultado(metodo: string, ultimosDigitos?: string): { resultado: ResultadoCobro; motivo?: string } {
  if (metodo === 'tarjeta' && ultimosDigitos === TARJETA_RECHAZADA) {
    return { resultado: 'rechazado', motivo: 'Fondos insuficientes' }
  }
  if (metodo === 'tarjeta' && ultimosDigitos === TARJETA_EN_PROCESO) {
    return { resultado: 'en_proceso' }
  }
  return { resultado: 'aprobado' }
}

export const mockPaymentRepository: PaymentRepository = {
  maxIntentosFallidos: MAX_INTENTOS_FALLIDOS,

  async charge(orderId, metodo, tarjeta) {
    const { resultado, motivo } = resolverResultado(metodo, tarjeta?.ultimosDigitos)

    const intento: PaymentAttempt = {
      id: generarIntentoId(),
      orderId,
      metodo,
      resultado,
      motivo,
      fecha: new Date().toISOString(),
    }
    INTENTOS.push(intento)

    if (resultado === 'aprobado') {
      await mockOrderRepository.updateEstado(orderId, 'pagada')
    } else if (resultado === 'en_proceso') {
      await mockOrderRepository.updateEstado(orderId, 'pago_en_proceso')
      setTimeout(() => {
        mockOrderRepository.updateEstado(orderId, 'pagada')
      }, RESOLUCION_EN_PROCESO_MS)
    } else {
      const fallidos = INTENTOS.filter((i) => i.orderId === orderId && i.resultado === 'rechazado').length
      if (fallidos >= MAX_INTENTOS_FALLIDOS) {
        await mockOrderRepository.updateEstado(orderId, 'pago_fallido')
      } else {
        await mockOrderRepository.updateEstado(orderId, 'pendiente_pago')
      }
    }

    return esperar(intento)
  },

  async countIntentosFallidos(orderId) {
    return esperar(INTENTOS.filter((i) => i.orderId === orderId && i.resultado === 'rechazado').length)
  },
}
