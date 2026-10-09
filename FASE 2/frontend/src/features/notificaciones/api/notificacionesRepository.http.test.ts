import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpNotificacionesRepository } from './notificacionesRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpNotificacionesRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('misNotificaciones() junta las notificaciones de cada orden del cliente, más reciente primero', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([{ orderId: 1 }, { orderId: 2 }]))
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, orderId: 1, channel: 'EMAIL', status: 'DELIVERED', message: 'Orden confirmada', createdAt: '2026-10-01T10:00:00Z', sentAt: '2026-10-01T10:00:05Z' },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 2, orderId: 2, channel: 'SMS', status: 'PENDING', message: 'Orden en despacho', createdAt: '2026-10-02T10:00:00Z', sentAt: null },
        ]),
      )

    const notificaciones = await httpNotificacionesRepository.misNotificaciones('101')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/customers/101/orders?limit=20')
    expect(notificaciones).toEqual([
      { id: 2, orderId: 2, canal: 'SMS', estado: 'PENDING', mensaje: 'Orden en despacho', creadaEn: '2026-10-02T10:00:00Z', enviadaEn: null },
      { id: 1, orderId: 1, canal: 'EMAIL', estado: 'DELIVERED', mensaje: 'Orden confirmada', creadaEn: '2026-10-01T10:00:00Z', enviadaEn: '2026-10-01T10:00:05Z' },
    ])
  })

  it('misNotificaciones() ignora una orden cuyas notificaciones fallan en vez de romper todo', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([{ orderId: 1 }, { orderId: 2 }]))
      .mockResolvedValueOnce(jsonResponse({ message: 'error' }, 500))
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 2, orderId: 2, channel: 'SMS', status: 'PENDING', message: 'Orden en despacho', createdAt: '2026-10-02T10:00:00Z', sentAt: null },
        ]),
      )

    const notificaciones = await httpNotificacionesRepository.misNotificaciones('101')
    expect(notificaciones).toHaveLength(1)
    expect(notificaciones[0].orderId).toBe(2)
  })

  it('misNotificaciones() devuelve una lista vacía si el cliente no tiene órdenes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]))
    const notificaciones = await httpNotificacionesRepository.misNotificaciones('999')
    expect(notificaciones).toEqual([])
  })
})
