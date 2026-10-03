export interface NotificacionCliente {
  id: number
  orderId: number
  canal: string
  estado: 'PENDING' | 'DELIVERED' | 'FAILED'
  mensaje: string
  creadaEn: string
  enviadaEn: string | null
}
