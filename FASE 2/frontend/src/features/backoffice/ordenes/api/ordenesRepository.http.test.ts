import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpOrdenesRepository } from './ordenesRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpOrdenesRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('search() manda los filtros y traduce el estado al del frontend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([{ orderId: 149, createdAt: null, customer: 'Cliente invitado', channel: 'WEB', status: 'IN_DISPATCH', total: 7000 }]),
    )
    const ordenes = await httpOrdenesRepository.search({ status: 'IN_DISPATCH', q: 'invitado', channel: 'WEB', limit: 20 })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/orders?status=IN_DISPATCH&q=invitado&channel=WEB&limit=20')
    expect(ordenes).toEqual([{ id: '149', cliente: 'Cliente invitado', canal: 'WEB', estado: 'en_despacho', total: 7000, creadaEn: '' }])
  })
})
