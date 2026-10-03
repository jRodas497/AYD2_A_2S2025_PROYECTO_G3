import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpCartRepository } from './cartRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const PRODUCTO_BACKEND = { id: 1, sku: 'LB-003', name: 'Estufa de 4 quemadores', category: 'LINEA_BLANCA', price: 2100, active: true }
const DISPONIBILIDAD = { productId: 1, totalAvailable: 5, byLocation: [] }

describe('httpCartRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getCart() enriquece cada item del backend con datos del catálogo', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [{ productId: 1, quantity: 2 }] }))
      .mockResolvedValueOnce(jsonResponse(PRODUCTO_BACKEND))
      .mockResolvedValueOnce(jsonResponse(DISPONIBILIDAD))

    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toEqual([
      { productId: '1', nombre: 'Estufa de 4 quemadores', sku: 'LB-003', cantidad: 2, precioUnitario: 2100 },
    ])
  })

  it('getCart() trata un carrito sin actividad (cartId null) como vacío', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ cartId: null, status: null, channel: null, items: [] }))
    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toEqual([])
  })

  it('getCart() omite un item cuyo producto ya no se puede consultar, sin tumbar el resto', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          cartId: 1,
          status: 'OPEN',
          channel: 'WEB',
          items: [
            { productId: 1, quantity: 1 },
            { productId: 2, quantity: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
      .mockResolvedValueOnce(jsonResponse({ ...PRODUCTO_BACKEND, id: 2 }))
      .mockResolvedValueOnce(jsonResponse({ ...DISPONIBILIDAD, productId: 2 }))

    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].productId).toBe('2')
  })

  it('addItem() manda productId numérico, cantidad y canal, y devuelve el carrito mapeado', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [{ productId: 1, quantity: 3 }] }))
      .mockResolvedValueOnce(jsonResponse(PRODUCTO_BACKEND))
      .mockResolvedValueOnce(jsonResponse(DISPONIBILIDAD))

    const cart = await httpCartRepository.addItem('7', '1', 3)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/7/cart/items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ productId: 1, quantity: 3, channel: 'WEB' }) }),
    )
    expect(cart.items[0].cantidad).toBe(3)
  })

  it('addItem() en un 404 (cliente o producto inexistente/inactivo) lanza un mensaje claro', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    await expect(httpCartRepository.addItem('7', '999', 1)).rejects.toThrow('El producto ya no está disponible o no existe')
  })

  it('setQuantity() manda PUT con la cantidad exacta y el canal', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [{ productId: 1, quantity: 5 }] }))
      .mockResolvedValueOnce(jsonResponse(PRODUCTO_BACKEND))
      .mockResolvedValueOnce(jsonResponse(DISPONIBILIDAD))

    const cart = await httpCartRepository.setQuantity('7', '1', 5)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/7/cart/items/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ quantity: 5, channel: 'WEB' }) }),
    )
    expect(cart.items[0].cantidad).toBe(5)
  })

  it('removeItem() manda DELETE y devuelve el carrito sin ese item', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [] }))

    const cart = await httpCartRepository.removeItem('7', '1')

    expect(fetchMock).toHaveBeenCalledWith('/api/customers/7/cart/items/1?channel=WEB', { method: 'DELETE' })
    expect(cart.items).toEqual([])
  })
})
