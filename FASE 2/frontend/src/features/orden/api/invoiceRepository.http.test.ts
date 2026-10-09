import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpInvoiceRepository } from './invoiceRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const FACTURA = {
  id: 10,
  orderId: 1,
  status: 'ACCEPTED',
  cui: '53F9C4F9-EF67-44D0-9C4B-4F62C0E38288',
  series: 'A',
  satResponse: 'aceptada',
  generatedAt: '2026-10-08T23:40:12Z',
  answeredAt: '2026-10-08T23:40:13Z',
}

describe('httpInvoiceRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ofOrder() devuelve la factura de la orden', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(FACTURA))
    const factura = await httpInvoiceRepository.ofOrder('1')

    expect(fetchMock).toHaveBeenCalledWith('/api/orders/1/invoice')
    expect(factura).toEqual(FACTURA)
  })

  it('ofOrder() devuelve null si la orden todavía no tiene factura (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const factura = await httpInvoiceRepository.ofOrder('999')
    expect(factura).toBeNull()
  })

  it('xmlUrl() arma la ruta del XML sin pedirlo (se abre directo en el navegador)', () => {
    expect(httpInvoiceRepository.xmlUrl('1')).toBe('/api/orders/1/invoice/xml')
  })
})
