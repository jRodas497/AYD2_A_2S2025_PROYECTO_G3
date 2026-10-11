import { apiFetch as fetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta, NotFoundError } from '../../../shared/api/httpErrors'

export interface Invoice {
  id: number
  orderId: number
  status: string
  cui: string
  series: string
  satResponse: string | null
  generatedAt: string
  answeredAt: string | null
}

export const httpInvoiceRepository = {
  async ofOrder(orderId: string): Promise<Invoice | null> {
    try {
      return await manejarRespuesta<Invoice>(await fetch(`/api/orders/${orderId}/invoice`))
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },

  /** URL del XML tal como se le transmitió a la SAT; se abre directo, no se descarga aquí. */
  xmlUrl(orderId: string): string {
    return `/api/orders/${orderId}/invoice/xml`
  },
}
