import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpIntegracionesRepository } from './integracionesRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function autenticarComoAdmin() {
  localStorage.setItem('sgo-admin-auth', JSON.stringify({ token: 'tok-123', username: 'admin', roles: ['ADMIN'] }))
}

describe('httpIntegracionesRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('salud() trae el resumen de circuitos, outbox, pos, avisos y erp', async () => {
    const salud = {
      circuitos: { PAYKLIK: 'CLOSED' },
      outbox: { PENDING: 2 },
      pos: { PENDING: 0 },
      avisos: { FAILED: 1 },
      erp: { PENDING: 0 },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(salud))
    expect(await httpIntegracionesRepository.salud()).toEqual(salud)
    expect(fetchMock).toHaveBeenCalledWith('/api/integration/health')
  })

  it('outbox() filtra por estado y límite', async () => {
    const eventos = [{ id: 1, aggregateType: 'PurchaseOrder', aggregateId: 1, eventType: 'ORDER_PAID', attempts: 1, createdAt: '2026-10-08T23:40:12Z' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(eventos))
    expect(await httpIntegracionesRepository.outbox('PENDING', 10)).toEqual(eventos)
    expect(fetchMock).toHaveBeenCalledWith('/api/integration/outbox?status=PENDING&limit=10')
  })

  it('reintentarOutbox() manda el token de la sesión de personal', async () => {
    autenticarComoAdmin()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    await httpIntegracionesRepository.reintentarOutbox(1)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/integration/outbox/1/retry')
    expect((opciones as RequestInit).method).toBe('POST')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('pos() filtra por estado y límite', async () => {
    const eventos = [{ id: 1, storeCode: 'T-01', eventType: 'SALE', status: 'PENDING' as const, attempts: 0, lastError: null, createdAt: '2026-10-08T23:40:12Z' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(eventos))
    expect(await httpIntegracionesRepository.pos('PENDING', 10)).toEqual(eventos)
    expect(fetchMock).toHaveBeenCalledWith('/api/integration/pos/events?status=PENDING&limit=10')
  })

  it('reintentarPos() manda el token de la sesión de personal', async () => {
    autenticarComoAdmin()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    await httpIntegracionesRepository.reintentarPos(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('erpBatches() trae los lotes recientes', async () => {
    const lotes = [{ id: 1, windowStart: '2026-10-08T23:00:00Z', windowEnd: '2026-10-08T23:30:00Z', status: 'PENDING', fileName: 'SGO-VENTAS.csv' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(lotes))
    expect(await httpIntegracionesRepository.erpBatches(5)).toEqual(lotes)
    expect(fetchMock).toHaveBeenCalledWith('/api/integration/erp/batches?limit=5')
  })

  it('generarLoteErp() manda el token de la sesión de personal', async () => {
    autenticarComoAdmin()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    await httpIntegracionesRepository.generarLoteErp()

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/integration/erp/batches')
    expect((opciones as RequestInit).method).toBe('POST')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('reintentarErp() sin sesión no manda Authorization', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    await httpIntegracionesRepository.reintentarErp(1)
    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/integration/erp/batches/1/retry')
    expect((opciones as RequestInit).headers).not.toHaveProperty('Authorization')
  })
})
