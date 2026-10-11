export interface SaludIntegraciones {
  circuitos: Record<string, string>
  outbox: Record<string, number>
  pos: Record<string, number>
  avisos: Record<string, number>
  erp: Record<string, number>
}

export interface OutboxEventoVista {
  id: number
  lastError?: string | null
  aggregateType: string
  aggregateId: number
  eventType: string
  attempts: number
  createdAt: string
}

export interface PosEventoVista {
  id: number
  storeCode: string
  eventType: string
  status: 'PENDING' | 'DELIVERED' | 'FAILED'
  attempts: number
  lastError: string | null
  createdAt: string
}

export interface ErpBatchVista {
  id: number
  windowStart: string
  windowEnd: string
  status: string
  fileName: string
  [key: string]: unknown
}
