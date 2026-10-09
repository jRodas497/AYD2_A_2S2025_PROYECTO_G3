import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpNotificacionesAdminRepository } from './notificacionesAdminRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const NOTIFICACION = {
  id: 5,
  orderId: 1,
  channel: 'EMAIL',
  status: 'FAILED' as const,
  recipient: 'cliente@example.com',
  message: 'Orden confirmada',
  attempts: 3,
  lastError: 'timeout',
  createdAt: '2026-10-08T23:40:12Z',
  sentAt: null,
}

describe('httpNotificacionesAdminRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('byStatus() filtra por estado y límite', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([NOTIFICACION]))
    const notificaciones = await httpNotificacionesAdminRepository.byStatus('FAILED', 10)

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications?status=FAILED&limit=10')
    expect(notificaciones).toEqual([NOTIFICACION])
  })

  it('retry() manda el token de la sesión de personal', async () => {
    localStorage.setItem('sgo-admin-auth', JSON.stringify({ token: 'tok-123', username: 'admin', roles: ['ADMIN'] }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ ...NOTIFICACION, status: 'PENDING', attempts: 4 }))
    await httpNotificacionesAdminRepository.retry(5)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notifications/5/retry')
    expect((opciones as RequestInit).method).toBe('POST')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('retry() sin sesión no manda Authorization', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(NOTIFICACION))
    await httpNotificacionesAdminRepository.retry(5)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization')
  })
})
