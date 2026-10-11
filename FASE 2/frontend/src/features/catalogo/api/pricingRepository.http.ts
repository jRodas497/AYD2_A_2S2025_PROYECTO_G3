import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { apiFetch } from '../../../shared/api/apiFetch'
import type { PricingRepository, Promotion } from './pricingRepository'
export const httpPricingRepository: PricingRepository = {
  async listActivePromotions() {
    const rows = await manejarRespuesta<(Promotion & { id: number; categoriasAplicables: string[] })[]>(await apiFetch('/api/promotions'))
    return rows.map(p => ({ ...p, id: String(p.id), categoriasAplicables: p.categoriasAplicables.map(c => c.toLowerCase()) }))
  },
}
