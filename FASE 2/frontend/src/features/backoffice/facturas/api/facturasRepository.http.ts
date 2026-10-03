import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { authHeaders } from '../../../../shared/context/AuthContext'

export interface FacturaAdmin {
  id: number
  orderId: number
  status: 'GENERATED' | 'SENT' | 'ACCEPTED' | 'REJECTED'
  cui: string
  series: string
  satResponse: string | null
  generatedAt: string
  answeredAt: string | null
}

export const httpFacturasRepository = {
  async byStatus(status: string, limit = 50): Promise<FacturaAdmin[]> {
    return manejarRespuesta<FacturaAdmin[]>(await fetch(`/api/invoices?status=${status}&limit=${limit}`))
  },

  /** Reintenta emitir/transmitir la factura de la orden a mano (CDU-03, E1/E2). */
  async reintentar(orderId: number): Promise<FacturaAdmin> {
    return manejarRespuesta<FacturaAdmin>(
      await fetch(`/api/orders/${orderId}/invoice`, { method: 'POST', headers: authHeaders() }),
    )
  },
}
