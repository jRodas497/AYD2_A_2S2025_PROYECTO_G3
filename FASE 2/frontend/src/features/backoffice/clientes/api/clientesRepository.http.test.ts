import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClientesRepository } from './clientesRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const cliente = { id: 15, fullName: 'Ana López', email: null, phone: '5555-1234', taxId: 'CF', address: null }

describe('httpClientesRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('search() manda q y limit y convierte los nulos en texto vacío', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([cliente]))
    const resultado = await httpClientesRepository.search('ana', 10)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/customers?q=ana&limit=10')
    expect(resultado).toEqual([{ id: '15', nombre: 'Ana López', email: '', telefono: '5555-1234' }])
  })

  it('detalle() junta el cliente, sus órdenes y sus incidencias', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        customer: cliente,
        orders: [{ orderId: 18, createdAt: null, channel: 'WEB', status: 'PAID', total: 390 }],
        incidents: [{ id: 3, orderId: 18, type: 'RETURN', status: 'REGISTERED', description: 'llegó dañado', createdAt: '2026-09-26T00:00:00Z' }],
      }),
    )
    const detalle = await httpClientesRepository.detalle('15')

    expect(detalle.taxId).toBe('CF')
    expect(detalle.direccion).toBe('')
    expect(detalle.ordenes[0]).toEqual({ orderId: '18', fecha: '', canal: 'WEB', estado: 'PAID', total: 390 })
    expect(detalle.incidencias[0].descripcion).toBe('llegó dañado')
  })

  it('actualizar() manda los datos con PUT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ ...cliente, address: 'Zona 10' }))
    const datos = { fullName: 'Ana López', email: '', phone: '5555-1234', address: 'Zona 10' }
    await httpClientesRepository.actualizar('15', datos)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/customers/15')
    expect((opciones as RequestInit).method).toBe('PUT')
    expect(JSON.parse((opciones as RequestInit).body as string)).toEqual(datos)
  })
})
