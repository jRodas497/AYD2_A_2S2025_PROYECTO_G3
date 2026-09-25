import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpPaymentRepository } from './paymentRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpPaymentRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('charge() manda el método mapeado y un token simulado, nunca el número de tarjeta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        { orderId: 12, attemptNumber: 1, result: 'APPROVED', orderStatus: 'PAID', providerReference: 'PK-1', latencyMs: 80, message: 'cobro aprobado' },
        201,
      ),
    )
    const intento = await httpPaymentRepository.charge('12', 'tarjeta', { ultimosDigitos: '4242' })

    const [, opciones] = fetchMock.mock.calls[0]
    const cuerpo = JSON.parse((opciones as RequestInit).body as string)
    expect(cuerpo.method).toBe('CARD')
    expect(cuerpo.cardLast4).toBe('4242')
    expect(cuerpo.cardToken).toMatch(/^tok_/)
    expect(cuerpo).not.toHaveProperty('cardNumber')
    expect(intento.resultado).toBe('aprobado')
  })

  it.each([
    ['APPROVED', 'aprobado'],
    ['DECLINED', 'rechazado'],
    ['TIMEOUT', 'en_proceso'],
    ['ERROR', 'en_proceso'],
  ])('mapea result=%s a resultado=%s', async (result, esperado) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ orderId: 1, attemptNumber: 1, result, orderStatus: 'PENDING_PAYMENT', providerReference: null, latencyMs: 10, message: 'x' }, 201),
    )
    const intento = await httpPaymentRepository.charge('1', 'tarjeta', { ultimosDigitos: '4242' })
    expect(intento.resultado).toBe(esperado)
  })

  it('countIntentosFallidos() cuenta solo los intentos DECLINED del historial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([
        { id: 1, attemptNumber: 1, result: 'DECLINED', amount: 100, providerReference: null, cardLast4: '4242', failureReason: 'sin fondos', latencyMs: 5, attemptedAt: '2026-09-25T00:00:00Z' },
        { id: 2, attemptNumber: 2, result: 'ERROR', amount: 100, providerReference: null, cardLast4: '4242', failureReason: 'timeout', latencyMs: 0, attemptedAt: '2026-09-25T00:01:00Z' },
        { id: 3, attemptNumber: 3, result: 'APPROVED', amount: 100, providerReference: 'PK-1', cardLast4: '4242', failureReason: null, latencyMs: 80, attemptedAt: '2026-09-25T00:02:00Z' },
      ]),
    )
    const fallidos = await httpPaymentRepository.countIntentosFallidos('1')
    expect(fallidos).toBe(1)
  })
})
