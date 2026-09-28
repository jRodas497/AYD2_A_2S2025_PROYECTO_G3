export interface LocationAvailability {
  locationCode: string
  locationName: string
  available: number
}

export interface Availability {
  productId: number
  totalAvailable: number
  byLocation: LocationAvailability[]
}

export interface StockMovement {
  id: number
  locationCode: string
  type: 'IN' | 'OUT'
  quantity: number
  reason: string
  orderId: number | null
  createdAt: string
  onHandNow: number
  reservedNow: number
}
