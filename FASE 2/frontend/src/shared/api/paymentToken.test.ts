import { afterEach, expect, it, vi } from 'vitest'
import { generarTokenSimulado } from './paymentToken'

afterEach(() => vi.restoreAllMocks())

it.each(['4111111111111111', '378282246310005', '4222222222222', '4000000000000000006'])(
  'a simulated token containing %s cannot be mistaken for a card number', pan => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(`${pan}-0000-4000-8000-000000000000`)
    const token = generarTokenSimulado()
    expect(token).toMatch(/^tok_[a-p-]+$/)
    expect(token).not.toMatch(/\d/)
    expect(token).not.toContain(pan)
  },
)

it('distinct UUIDs remain distinct after encoding', () => {
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000000')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
  expect(generarTokenSimulado()).not.toBe(generarTokenSimulado())
})

it('repayment exposes at most the last four digits followed by a safe opaque identifier', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('41111111-1111-4111-8111-111111111111')
  expect(generarTokenSimulado('tok_credit_4242_')).toMatch(/^tok_credit_4242_[a-p-]+$/)
})
