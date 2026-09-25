import { beforeEach, describe, expect, it } from 'vitest'
import { mockPaymentRepository } from './paymentRepository.mock'
import { mockOrderRepository } from '../../orden/api/orderRepository.mock'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

async function crearOrden() {
  return mockOrderRepository.createOrder({ customerId: 'cliente-x', items: [ITEM], metodoEntrega: 'tienda' })
}

describe('mockPaymentRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('una tarjeta terminada en 0000 es rechazada y la orden vuelve a pendiente_pago', async () => {
    const orden = await crearOrden()
    const intento = await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '0000' })
    expect(intento.resultado).toBe('rechazado')
    expect(intento.motivo).toBeTruthy()
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pendiente_pago')
  })

  it('una tarjeta terminada en 1111 deja la orden inmediatamente en pago_en_proceso, sin bloquear', async () => {
    const orden = await crearOrden()
    const inicio = Date.now()
    const intento = await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '1111' })
    expect(Date.now() - inicio).toBeLessThan(500)
    expect(intento.resultado).toBe('en_proceso')

    const enProceso = await mockOrderRepository.getOrder(orden.id)
    expect(enProceso?.estado).toBe('pago_en_proceso')
  })

  it('cualquier otra tarjeta o método es aprobado y marca la orden como pagada', async () => {
    const orden = await crearOrden()
    const intento = await mockPaymentRepository.charge(orden.id, 'transferencia')
    expect(intento.resultado).toBe('aprobado')
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pagada')
  })

  it('tras agotar el máximo de intentos fallidos, la orden queda en pago_fallido', async () => {
    const orden = await crearOrden()
    for (let i = 0; i < mockPaymentRepository.maxIntentosFallidos; i += 1) {
      await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '0000' })
    }
    const fallidos = await mockPaymentRepository.countIntentosFallidos(orden.id)
    expect(fallidos).toBe(mockPaymentRepository.maxIntentosFallidos)
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pago_fallido')
  })
})
