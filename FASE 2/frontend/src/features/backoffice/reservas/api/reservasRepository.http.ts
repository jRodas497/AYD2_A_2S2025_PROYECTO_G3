import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import type { ReservaStock } from '../types'

interface BackendReservationView {
  id: number
  orderId: number
  productId: number
  sku: string
  productName: string
  locationCode: string
  quantity: number
  status: string
  createdAt: string
  expiresAt: string
  closedAt: string | null
}

export const httpReservasRepository = {
  async search(filtros: { status?: string; limit?: number }): Promise<ReservaStock[]> {
    const params = new URLSearchParams()
    if (filtros.status) params.set('status', filtros.status)
    params.set('limit', String(filtros.limit ?? 100))
    const lista = await manejarRespuesta<BackendReservationView[]>(
      await fetch(`/api/inventory/reservations?${params.toString()}`),
    )
    return lista.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      sku: r.sku,
      productoNombre: r.productName,
      ubicacion: r.locationCode,
      cantidad: r.quantity,
      estado: r.status as ReservaStock['estado'],
      creadaEn: r.createdAt,
      expiraEn: r.expiresAt,
      cerradaEn: r.closedAt,
    }))
  },
}
