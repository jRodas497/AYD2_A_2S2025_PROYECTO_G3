export interface ReservaStock {
  id: number
  orderId: number
  sku: string
  productoNombre: string
  ubicacion: string
  cantidad: number
  estado: 'ACTIVE' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'
  creadaEn: string
  expiraEn: string
  cerradaEn: string | null
}
