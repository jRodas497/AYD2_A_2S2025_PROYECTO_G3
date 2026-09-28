import type { AuditEntry, AuditSearchFilters } from '../types'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'

interface BackendAuditEntry {
  id: number
  occurredAt: string
  actor: string
  action: string
  entityType: string
  entityId: string
  orderId: number | null
  channel: string | null
  details: Record<string, unknown>
}

function mapear(entrada: BackendAuditEntry): AuditEntry {
  return {
    id: entrada.id,
    ocurrioEn: entrada.occurredAt,
    actor: entrada.actor,
    accion: entrada.action,
    tipoEntidad: entrada.entityType,
    idEntidad: entrada.entityId,
    orderId: entrada.orderId,
    canal: entrada.channel,
    detalle: entrada.details ?? {},
  }
}

export const httpAuditoriaRepository = {
  async search(filtros: AuditSearchFilters): Promise<AuditEntry[]> {
    const params = new URLSearchParams()
    if (filtros.orderId) params.set('orderId', filtros.orderId)
    if (filtros.entityType) params.set('entityType', filtros.entityType)
    if (filtros.action) params.set('action', filtros.action)
    params.set('limit', String(filtros.limit ?? 100))
    const entradas = await manejarRespuesta<BackendAuditEntry[]>(await fetch(`/api/audit?${params.toString()}`))
    return entradas.map(mapear)
  },

  async traceOfOrder(orderId: string): Promise<AuditEntry[]> {
    const trace = await manejarRespuesta<{ timeline: BackendAuditEntry[] }>(
      await fetch(`/api/orders/${orderId}/trace`),
    )
    return trace.timeline.map(mapear)
  },
}
