import type { PaymentRepository } from './paymentRepository'
import type { PaymentAttempt, ResultadoCobro } from '../types'
import { mockOrderRepository, RESOLUCION_EN_PROCESO_MS } from '../../orden/api/orderRepository.mock'

const LATENCIA_MS = 200
const MAX_INTENTOS_FALLIDOS = 3
const ATTEMPTS_STORAGE_KEY = 'sgo-payment-attempts'

const TARJETA_RECHAZADA = '0000'
const TARJETA_EN_PROCESO = '1111'

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function cargarIntentos(): PaymentAttempt[] {
  const crudo = localStorage.getItem(ATTEMPTS_STORAGE_KEY)
  if (!crudo) return []
  try {
    return JSON.parse(crudo) as PaymentAttempt[]
  } catch {
    return []
  }
}

function guardarIntentos(intentos: PaymentAttempt[]): void {
  localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(intentos))
}

function generarIntentoId(intentos: PaymentAttempt[]): string {
  const maximo = intentos.reduce((max, i) => {
    const numero = Number(i.id.replace('PAY-', ''))
    return Number.isFinite(numero) && numero > max ? numero : max
  }, 0)
  return `PAY-${String(maximo + 1).padStart(6, '0')}`
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
    const intentos = cargarIntentos()
    const { resultado, motivo } = resolverResultado(metodo, tarjeta?.ultimosDigitos)

    const intento: PaymentAttempt = {
      id: generarIntentoId(intentos),
      orderId,
      metodo,
      resultado,
      motivo,
      fecha: new Date().toISOString(),
    }
    intentos.push(intento)
    guardarIntentos(intentos)

    if (resultado === 'aprobado') {
      await mockOrderRepository.updateEstado(orderId, 'pagada')
    } else if (resultado === 'en_proceso') {
      await mockOrderRepository.updateEstado(orderId, 'pago_en_proceso')
      // Resuelve en vivo si la pestaña se queda abierta; si se recarga antes de esto,
      // orderRepository.getOrder() resuelve igual al leer, por el umbral de tiempo persistido.
      setTimeout(() => {
        mockOrderRepository.updateEstado(orderId, 'pagada')
      }, RESOLUCION_EN_PROCESO_MS)
    } else {
      const fallidos = intentos.filter((i) => i.orderId === orderId && i.resultado === 'rechazado').length
      if (fallidos >= MAX_INTENTOS_FALLIDOS) {
        await mockOrderRepository.updateEstado(orderId, 'pago_fallido')
      } else {
        await mockOrderRepository.updateEstado(orderId, 'pendiente_pago')
      }
    }

    return esperar(intento)
  },

  async countIntentosFallidos(orderId) {
    const intentos = cargarIntentos()
    return esperar(intentos.filter((i) => i.orderId === orderId && i.resultado === 'rechazado').length)
  },
}
