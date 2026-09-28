import type { Availability, StockMovement } from '../types'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'

export const httpInventoryOpsRepository = {
  async availability(productId: number): Promise<Availability> {
    return manejarRespuesta<Availability>(await fetch(`/api/inventory/products/${productId}/availability`))
  },

  async movements(productId: number, limit = 20): Promise<StockMovement[]> {
    return manejarRespuesta<StockMovement[]>(
      await fetch(`/api/inventory/products/${productId}/movements?limit=${limit}`),
    )
  },

  async registerMovement(input: {
    locationCode: string
    productId: number
    type: 'IN' | 'OUT'
    quantity: number
    reason: string
  }): Promise<StockMovement> {
    return manejarRespuesta<StockMovement>(
      await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
  },

  async adjust(input: { locationCode: string; productId: number; countedQuantity: number; source?: string }) {
    return manejarRespuesta<{ locationCode: string; productId: number; registered: number; counted: number; difference: number; reserved: number }>(
      await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
  },
}
