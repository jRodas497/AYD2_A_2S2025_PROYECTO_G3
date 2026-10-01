import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpAuditoriaRepository } from './auditoriaRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const entrada = {
  id: 7,
  occurredAt: '2026-09-26T04:46:29Z',
  actor: 'admin',
  action: 'INCIDENCIA_RESOLVED',
  entityType: 'incident',
  entityId: '1',
  orderId: 85,
  channel: 'WEB',
  details: { tipo: 'RETURN' },
}

describe('httpAuditoriaRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('search() arma la consulta solo con los filtros presentes y mapea cada entrada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([entrada]))
    const resultado = await httpAuditoriaRepository.search({ orderId: '85', limit: 20 })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/audit?orderId=85&limit=20')
    expect(resultado[0]).toEqual({
      id: 7,
      ocurrioEn: '2026-09-26T04:46:29Z',
      actor: 'admin',
      accion: 'INCIDENCIA_RESOLVED',
      tipoEntidad: 'incident',
      idEntidad: '1',
      orderId: 85,
      canal: 'WEB',
      detalle: { tipo: 'RETURN' },
    })
  })

  it('traceOfOrder() devuelve la línea de tiempo de la orden', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ timeline: [entrada, entrada] }))
    const resultado = await httpAuditoriaRepository.traceOfOrder('85')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/85/trace')
    expect(resultado).toHaveLength(2)
  })
})
