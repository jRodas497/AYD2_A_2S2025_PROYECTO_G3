import { apiFetch as fetch } from '../../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import type { ClienteDetalle, ClienteResumen } from '../types'

interface BackendCustomer {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  taxId: string
  address: string | null
}

interface BackendOrderOverview {
  orderId: number
  createdAt: string | null
  channel: string
  status: string
  total: number
}

interface BackendIncident {
  id: number
  orderId: number
  type: string
  status: string
  description: string
  createdAt: string
}

interface BackendHistory {
  customer: BackendCustomer
  orders: BackendOrderOverview[]
  incidents: BackendIncident[]
}

function mapearResumen(c: BackendCustomer): ClienteResumen {
  return { id: String(c.id), nombre: c.fullName, email: c.email ?? '', telefono: c.phone ?? '' }
}

export const httpClientesRepository = {
  async search(q: string, limit = 50): Promise<ClienteResumen[]> {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('limit', String(limit))
    const clientes = await manejarRespuesta<BackendCustomer[]>(await fetch(`/api/customers?${params.toString()}`))
    return clientes.map(mapearResumen)
  },

  async detalle(id: string): Promise<ClienteDetalle> {
    const historia = await manejarRespuesta<BackendHistory>(await fetch(`/api/customers/${id}/history?limit=50`))
    return {
      ...mapearResumen(historia.customer),
      direccion: historia.customer.address ?? '',
      taxId: historia.customer.taxId,
      ordenes: historia.orders.map((o) => ({
        orderId: String(o.orderId),
        fecha: o.createdAt ?? '',
        canal: o.channel,
        estado: o.status,
        total: o.total,
      })),
      incidencias: historia.incidents.map((i) => ({
        id: i.id,
        orderId: i.orderId,
        tipo: i.type,
        estado: i.status,
        descripcion: i.description,
        creadaEn: i.createdAt,
      })),
    }
  },

  async actualizar(
    id: string,
    datos: { fullName: string; email: string; phone: string; address: string },
  ): Promise<ClienteResumen> {
    const actualizado = await manejarRespuesta<BackendCustomer>(
      await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      }),
    )
    return mapearResumen(actualizado)
  },
}
