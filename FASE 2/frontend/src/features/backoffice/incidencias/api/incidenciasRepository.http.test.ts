import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpIncidenciasRepository } from './incidenciasRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpIncidenciasRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('search() filtra por estado y tipo y mapea la bandeja', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([
        {
          id: 1, orderId: 85, customerId: 47, customer: 'Cliente 47', type: 'RETURN', status: 'REGISTERED',
          description: 'prueba', orderTotal: 390, createdAt: '2026-09-26T04:46:29Z', resolvedAt: null,
        },
      ]),
    )
    const resultado = await httpIncidenciasRepository.search({ status: 'REGISTERED', type: 'RETURN' })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/incidents?status=REGISTERED&type=RETURN&limit=100')
    expect(resultado[0]).toMatchObject({ clienteId: 47, cliente: 'Cliente 47', tipo: 'RETURN', totalOrden: 390, resueltaEn: null })
  })

  it('updateStatus() manda el token de la sesión de personal', async () => {
    localStorage.setItem('sgo-admin-auth', JSON.stringify({ token: 'tok-123', username: 'admin', roles: ['ADMIN'] }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    await httpIncidenciasRepository.updateStatus(1, 'RESOLVED')

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/incidents/1/status')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
    expect(JSON.parse((opciones as RequestInit).body as string)).toEqual({ status: 'RESOLVED' })
  })

  it('updateStatus() sin sesión no manda Authorization y propaga el 401', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ status: 401, message: 'hace falta iniciar sesión' }, 401))

    await expect(httpIncidenciasRepository.updateStatus(1, 'RESOLVED')).rejects.toThrow()
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization')
  })
})
