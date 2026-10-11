export interface IncidenciaGlobal {
  id: number
  orderId: number
  clienteId: number
  cliente: string
  tipo: 'EXCHANGE' | 'RETURN'
  estado: 'REGISTERED' | 'IN_PROCESS' | 'RESOLVED' | 'REJECTED'
  descripcion: string
  totalOrden: number
  creadaEn: string
  resueltaEn: string | null
  replacementOrderId?: number | null
}
