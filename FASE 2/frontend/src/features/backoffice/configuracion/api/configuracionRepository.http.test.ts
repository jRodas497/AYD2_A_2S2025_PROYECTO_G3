import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpConfiguracionRepository } from './configuracionRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function iniciarSesion() {
  localStorage.setItem('sgo-admin-auth', JSON.stringify({ token: 'tok-admin', username: 'admin', roles: ['ADMIN'] }))
}

describe('httpConfiguracionRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('listSettings() es una consulta abierta, sin token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]))
    await httpConfiguracionRepository.listSettings()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/settings')
  })

  it('listUsers() manda el token, porque la lista de personal exige ADMIN', async () => {
    iniciarSesion()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]))
    await httpConfiguracionRepository.listUsers()

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-admin' })
  })

  it('updateSetting() codifica la clave y manda el valor con el token', async () => {
    iniciarSesion()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ key: 'reservation.ttl_minutes', value: '25' }))
    await httpConfiguracionRepository.updateSetting('reservation.ttl_minutes', '25')

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/settings/reservation.ttl_minutes')
    expect((opciones as RequestInit).method).toBe('PUT')
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-admin' })
    expect(JSON.parse((opciones as RequestInit).body as string)).toEqual({ value: '25' })
  })

  it('setActive() desactiva al usuario en lugar de borrarlo', async () => {
    iniciarSesion()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ id: 2, active: false }))
    await httpConfiguracionRepository.setActive(2, false)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users/2/active')
    expect((opciones as RequestInit).method).toBe('PUT')
    expect(JSON.parse((opciones as RequestInit).body as string)).toEqual({ active: false })
  })
})
