import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpOrderRepository } from './orderRepository.http'
import { obtenerSnapshot } from './orderItemsSnapshot'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

const CHECKOUT_RESPONSE = {
  id: 12,
  cartId: 3,
  customerId: 7,
  channel: 'WEB',
  status: 'PENDING_PAYMENT',
  total: 4999,
  deliveryAddress: 'Zona 10',
  createdAt: null,
  updatedAt: '2026-09-25T04:05:48Z',
}

describe('httpOrderRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createOrder() manda customerId numérico y deliveryAddress, y mapea la respuesta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))

    const orden = await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/orders/checkout',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ customerId: 7, deliveryAddress: 'Zona 10' }) }),
    )
    expect(orden).toEqual({
      id: '12',
      customerId: '7',
      items: [ITEM],
      total: 4999,
      direccionEntrega: 'Zona 10',
      estado: 'pendiente_pago',
      creadaEn: '2026-09-25T04:05:48Z',
    })
  })

  it('createOrder() guarda el snapshot local de items y dirección para completar la vista de detalle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))
    await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(obtenerSnapshot('12')).toEqual({ items: [ITEM], direccionEntrega: 'Zona 10' })
  })

  it('createOrder() propaga el mensaje real de un 409 (producto inactivo o sin stock)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        { timestamp: '2026-09-25T00:00:00Z', status: 409, error: 'Conflict', message: 'no hay existencia suficiente del producto 1 para reservar 2 unidad(es)', path: '/api/orders/checkout' },
        409,
      ),
    )
    await expect(
      httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' }),
    ).rejects.toThrow('no hay existencia suficiente del producto 1 para reservar 2 unidad(es)')
  })

  it('getOrder() mapea los 9 estados posibles y usa el snapshot para items/dirección', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))
    await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        orderId: 12,
        createdAt: '2026-09-25T04:05:48Z',
        customerId: 7,
        customer: 'Cliente 7',
        channel: 'WEB',
        status: 'IN_DISPATCH',
        total: 4999,
        lastPaymentResult: 'APPROVED',
        paymentAttempts: 1,
        invoiceStatus: 'ACCEPTED',
        shipmentStatus: 'GUIDE_ISSUED',
        trackingNumber: 'LX-1',
      }),
    )
    const orden = await httpOrderRepository.getOrder('12')
    expect(orden?.estado).toBe('en_despacho')
    expect(orden?.items).toEqual([ITEM])
    expect(orden?.direccionEntrega).toBe('Zona 10')
    expect(orden?.trackingNumber).toBe('LX-1')
  })

  it('getOrder() devuelve null en 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const orden = await httpOrderRepository.getOrder('999')
    expect(orden).toBeNull()
  })

  it('getOrder() sin snapshot local devuelve items vacíos y dirección vacía, sin lanzar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        orderId: 30,
        createdAt: '2026-09-25T04:05:48Z',
        customerId: 7,
        customer: 'Cliente 7',
        channel: 'WEB',
        status: 'PAID',
        total: 100,
        lastPaymentResult: 'APPROVED',
        paymentAttempts: 1,
        invoiceStatus: null,
        shipmentStatus: null,
        trackingNumber: null,
      }),
    )
    const orden = await httpOrderRepository.getOrder('30')
    expect(orden?.items).toEqual([])
    expect(orden?.direccionEntrega).toBe('')
  })

  it('listOrders() consulta el historial real del cliente en el backend, no un índice local', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([
        {
          orderId: 12,
          createdAt: '2026-09-25T04:05:48Z',
          customerId: 7,
          customer: 'Cliente 7',
          channel: 'WEB',
          status: 'PENDING_PAYMENT',
          total: 4999,
          lastPaymentResult: null,
          paymentAttempts: null,
          invoiceStatus: null,
          shipmentStatus: null,
          trackingNumber: null,
        },
      ]),
    )
    const ordenes = await httpOrderRepository.listOrders('7')
    expect(fetchMock).toHaveBeenCalledWith('/api/customers/7/orders?limit=50')
    expect(ordenes).toHaveLength(1)
    expect(ordenes[0].id).toBe('12')
  })

  it('listOrders() devuelve [] si el cliente no existe (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'cliente no encontrado' }, 404))
    const ordenes = await httpOrderRepository.listOrders('999')
    expect(ordenes).toEqual([])
  })

  it('updateEstado() lanza — el backend real controla el estado de la orden', async () => {
    await expect(httpOrderRepository.updateEstado('1', 'pagada')).rejects.toThrow()
  })
})
