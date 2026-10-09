import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpFacturasRepository } from './facturasRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const FACTURA = {
  id: 10,
  orderId: 1,
  status: 'ACCEPTED' as const,
  cui: '53F9C4F9-EF67-44D0-9C4B-4F62C0E38288',
  series: 'A',
  satResponse: 'aceptada',
  generatedAt: '2026-10-08T23:40:12Z',
  answeredAt: '2026-10-08T23:40:13Z',
}

describe('httpFacturasRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('byStatus() filtra por estado y límite', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([FACTURA]))
    const facturas = await httpFacturasRepository.byStatus('ACCEPTED', 10)

    expect(fetchMock).toHaveBeenCalledWith('/api/invoices?status=ACCEPTED&limit=10')
    expect(facturas).toEqual([FACTURA])
  })

  it('reintentar() manda el token de la sesión de personal', async () => {
    localStorage.setItem('sgo-admin-auth', JSON.stringify({ token: 'tok-123', username: 'admin', roles: ['ADMIN'] }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(FACTURA))
    await httpFacturasRepository.reintentar(1)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/orders/1/invoice')
    expect((opciones as RequestInit).method).toBe('POST')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('reintentar() sin sesión no manda Authorization', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(FACTURA))
    await httpFacturasRepository.reintentar(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization')
  })
})
