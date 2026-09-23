import { describe, expect, it } from 'vitest'
import { mockOrderRepository } from './orderRepository.mock'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

describe('mockOrderRepository', () => {
  it('crea una orden en estado pendiente_pago con el total calculado', async () => {
    const orden = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      metodoEntrega: 'tienda',
    })
    expect(orden.estado).toBe('pendiente_pago')
    expect(orden.total).toBe(4999)
    expect(orden.metodoEntrega).toBe('tienda')
    expect(orden.id).toBeTruthy()
  })

  it('cada orden creada tiene un id distinto', async () => {
    const a = await mockOrderRepository.createOrder({ customerId: 'c', items: [ITEM], metodoEntrega: 'tienda' })
    const b = await mockOrderRepository.createOrder({ customerId: 'c', items: [ITEM], metodoEntrega: 'tienda' })
    expect(a.id).not.toBe(b.id)
  })

  it('getOrder recupera una orden ya creada', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      metodoEntrega: 'recogida',
    })
    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada).toEqual(creada)
  })

  it('getOrder retorna null si el id no existe', async () => {
    const resultado = await mockOrderRepository.getOrder('SGO-NOEXISTE')
    expect(resultado).toBeNull()
  })

  it('updateEstado cambia el estado de una orden existente', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      metodoEntrega: 'tienda',
    })
    const actualizada = await mockOrderRepository.updateEstado(creada.id, 'pagada')
    expect(actualizada?.estado).toBe('pagada')
    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada?.estado).toBe('pagada')
  })

  it('updateEstado retorna null si el id no existe', async () => {
    const resultado = await mockOrderRepository.updateEstado('SGO-NOEXISTE', 'pagada')
    expect(resultado).toBeNull()
  })
})
