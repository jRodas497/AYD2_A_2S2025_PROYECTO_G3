import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpInventoryOpsRepository } from './inventoryOpsRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpInventoryOpsRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('availability() consulta la disponibilidad consolidada del producto', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ productId: 1, totalAvailable: 928, byLocation: [{ locationCode: 'CD-01', locationName: 'Centro 1', available: 191 }] }),
    )
    const disponibilidad = await httpInventoryOpsRepository.availability(1)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/inventory/products/1/availability')
    expect(disponibilidad.totalAvailable).toBe(928)
  })

  it('movements() pide el historial con el límite indicado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]))
    await httpInventoryOpsRepository.movements(3, 5)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/inventory/products/3/movements?limit=5')
  })

  it('registerMovement() manda el movimiento con POST', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 201))
    const movimiento = { locationCode: 'T-01', productId: 1, type: 'IN' as const, quantity: 10, reason: 'reposición' }
    await httpInventoryOpsRepository.registerMovement(movimiento)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/inventory/movements')
    expect((opciones as RequestInit).method).toBe('POST')
    expect(JSON.parse((opciones as RequestInit).body as string)).toEqual(movimiento)
  })

  it('adjust() devuelve la diferencia contra el conteo físico', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ locationCode: 'T-01', productId: 1, registered: 24, counted: 20, difference: -4, reserved: 0 }),
    )
    const ajuste = await httpInventoryOpsRepository.adjust({ locationCode: 'T-01', productId: 1, countedQuantity: 20 })

    expect(ajuste.difference).toBe(-4)
  })
})
