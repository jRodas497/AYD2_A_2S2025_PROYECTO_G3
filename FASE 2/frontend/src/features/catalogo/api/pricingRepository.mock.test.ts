import { describe, expect, it } from 'vitest'
import { mockPricingRepository } from './pricingRepository.mock'

describe('mockPricingRepository', () => {
  it('lista las promociones vigentes', async () => {
    const promos = await mockPricingRepository.listActivePromotions()
    expect(promos.length).toBeGreaterThan(0)
    expect(promos[0]).toHaveProperty('nombre')
    expect(promos[0]).toHaveProperty('descuentoPorcentaje')
  })
})
