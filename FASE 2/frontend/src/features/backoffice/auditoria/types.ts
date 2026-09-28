export interface AuditEntry {
  id: number
  ocurrioEn: string
  actor: string
  accion: string
  tipoEntidad: string
  idEntidad: string
  orderId: number | null
  canal: string | null
  detalle: Record<string, unknown>
}

export interface AuditSearchFilters {
  orderId?: string
  entityType?: string
  action?: string
  limit?: number
}
