import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { authHeaders } from '../../../../shared/context/AuthContext'
import type { IncidenciaGlobal } from '../types'

interface BackendIncidentOverview {
  id: number
  orderId: number
  customerId: number
  customer: string
  type: string
  status: string
  description: string
  orderTotal: number
  createdAt: string
  resolvedAt: string | null
}

function mapear(i: BackendIncidentOverview): IncidenciaGlobal {
  return {
    id: i.id,
    orderId: i.orderId,
    clienteId: i.customerId,
    cliente: i.customer,
    tipo: i.type as IncidenciaGlobal['tipo'],
    estado: i.status as IncidenciaGlobal['estado'],
    descripcion: i.description,
    totalOrden: i.orderTotal,
    creadaEn: i.createdAt,
    resueltaEn: i.resolvedAt,
  }
}

export const httpIncidenciasRepository = {
  async search(filtros: { status?: string; type?: string; limit?: number }): Promise<IncidenciaGlobal[]> {
    const params = new URLSearchParams()
    if (filtros.status) params.set('status', filtros.status)
    if (filtros.type) params.set('type', filtros.type)
    params.set('limit', String(filtros.limit ?? 100))
    const lista = await manejarRespuesta<BackendIncidentOverview[]>(await fetch(`/api/incidents?${params.toString()}`))
    return lista.map(mapear)
  },

  async updateStatus(id: number, status: 'IN_PROCESS' | 'RESOLVED' | 'REJECTED'): Promise<void> {
    await manejarRespuesta(
      await fetch(`/api/incidents/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status }),
      }),
    )
  },
}
