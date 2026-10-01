import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpShipmentsRepository } from './shipmentsRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const envio = {
  id: 4,
  orderId: 85,
  originLocation: 'CD-01',
  carrier: 'LOGIEXPRESS',
  status: 'GUIDE_ISSUED',
  trackingNumber: 'LX-123',
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:01:00Z',
  tracking: [{ status: 'GUIDE_ISSUED', detail: 'guía emitida', occurredAt: '2026-09-26T00:01:00Z' }],
}

describe('httpShipmentsRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('byStatus() codifica el estado y mapea el envío con su seguimiento', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([envio]))
    const lista = await httpShipmentsRepository.byStatus('GUIDE_REQUESTED', 10)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/shipments?status=GUIDE_REQUESTED&limit=10')
    expect(lista[0]).toMatchObject({ origenUbicacion: 'CD-01', transportista: 'LOGIEXPRESS', numeroGuia: 'LX-123' })
    expect(lista[0].seguimiento[0]).toEqual({ estado: 'GUIDE_ISSUED', detalle: 'guía emitida', ocurrioEn: '2026-09-26T00:01:00Z' })
  })

  it('byOrder() devuelve null cuando la orden todavía no tiene envío', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ status: 404 }, 404))
    expect(await httpShipmentsRepository.byOrder('85')).toBeNull()
  })

  it('requestGuide() pide la guía con POST', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(envio))
    await httpShipmentsRepository.requestGuide(4)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/shipments/4/guide')
    expect((opciones as RequestInit).method).toBe('POST')
  })

  it('reassignOrigin() manda la ubicación nueva', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ ...envio, originLocation: 'T-05' }))
    const actualizado = await httpShipmentsRepository.reassignOrigin(4, 'T-05')

    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ locationCode: 'T-05' })
    expect(actualizado.origenUbicacion).toBe('T-05')
  })
})
