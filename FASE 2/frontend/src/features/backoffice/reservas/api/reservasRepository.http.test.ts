import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpReservasRepository } from './reservasRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpReservasRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('search() filtra por estado y mapea la reserva con producto y ubicación', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([
        {
          id: 84, orderId: 149, productId: 2, sku: 'LB-002', productName: 'Lavadora 18 kg', locationCode: 'CD-01', quantity: 2,
          status: 'ACTIVE', createdAt: '2026-09-26T17:37:00Z', expiresAt: '2026-09-26T17:57:00Z', closedAt: null,
        },
      ]),
    )
    const reservas = await httpReservasRepository.search({ status: 'ACTIVE' })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/inventory/reservations?status=ACTIVE&limit=100')
    expect(reservas[0]).toEqual({
      id: 84, orderId: 149, sku: 'LB-002', productoNombre: 'Lavadora 18 kg', ubicacion: 'CD-01', cantidad: 2,
      estado: 'ACTIVE', creadaEn: '2026-09-26T17:37:00Z', expiraEn: '2026-09-26T17:57:00Z', cerradaEn: null,
    })
  })
})
