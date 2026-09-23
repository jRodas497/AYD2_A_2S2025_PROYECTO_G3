import { beforeEach, describe, expect, it } from 'vitest'
import { mockOrderRepository, ORDERS_STORAGE_KEY, RESOLUCION_EN_PROCESO_MS } from './orderRepository.mock'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

describe('mockOrderRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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

  it('las órdenes sobreviven a un round-trip de localStorage (simula recargar la página)', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      metodoEntrega: 'tienda',
    })
    const crudo = localStorage.getItem(ORDERS_STORAGE_KEY)
    expect(crudo).toBeTruthy()
    const persistidas = JSON.parse(crudo!)
    expect(persistidas.find((o: { id: string }) => o.id === creada.id)).toBeTruthy()
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna lista vacía', async () => {
    localStorage.setItem(ORDERS_STORAGE_KEY, '{esto no es json')
    const resultado = await mockOrderRepository.getOrder('SGO-000001')
    expect(resultado).toBeNull()
  })

  it('listOrders retorna solo las órdenes del cliente indicado, más reciente primero', async () => {
    const a = await mockOrderRepository.createOrder({ customerId: 'cliente-a', items: [ITEM], metodoEntrega: 'tienda' })
    await mockOrderRepository.createOrder({ customerId: 'cliente-b', items: [ITEM], metodoEntrega: 'tienda' })
    const c = await mockOrderRepository.createOrder({ customerId: 'cliente-a', items: [ITEM], metodoEntrega: 'tienda' })

    const propias = await mockOrderRepository.listOrders('cliente-a')
    expect(propias.map((o) => o.id)).toEqual([c.id, a.id])
  })

  it('getOrder resuelve pago_en_proceso a pagada si ya pasó el umbral, aunque se haya perdido el temporizador (recarga)', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      metodoEntrega: 'tienda',
    })
    await mockOrderRepository.updateEstado(creada.id, 'pago_en_proceso')

    // Simula que el tiempo ya pasó y la pestaña se recargó (el setTimeout en memoria se perdió).
    const ordenes = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)!)
    const idx = ordenes.findIndex((o: { id: string }) => o.id === creada.id)
    ordenes[idx].enProcesoDesde = new Date(Date.now() - RESOLUCION_EN_PROCESO_MS - 1000).toISOString()
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordenes))

    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada?.estado).toBe('pagada')
  })
})
