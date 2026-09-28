import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { mapearEstado } from '../../../orden/api/orderRepository.http'
import type { EstadoOrden } from '../../../orden/types'

export interface OrdenBackoffice {
  id: string
  cliente: string
  canal: string
  estado: EstadoOrden
  total: number
  creadaEn: string
}

interface BackendOrderOverview {
  orderId: number
  createdAt: string | null
  customer: string
  channel: string
  status: string
  total: number
}

export interface OrdenesFiltros {
  status?: string
  q?: string
  channel?: string
  limit?: number
}

export const httpOrdenesRepository = {
  async search(filtros: OrdenesFiltros): Promise<OrdenBackoffice[]> {
    const params = new URLSearchParams()
    if (filtros.status) params.set('status', filtros.status)
    if (filtros.q) params.set('q', filtros.q)
    if (filtros.channel) params.set('channel', filtros.channel)
    params.set('limit', String(filtros.limit ?? 100))
    const overviews = await manejarRespuesta<BackendOrderOverview[]>(await fetch(`/api/orders?${params.toString()}`))
    return overviews.map((o) => ({
      id: String(o.orderId),
      cliente: o.customer,
      canal: o.channel,
      estado: mapearEstado(o.status),
      total: o.total,
      creadaEn: o.createdAt ?? '',
    }))
  },
}
