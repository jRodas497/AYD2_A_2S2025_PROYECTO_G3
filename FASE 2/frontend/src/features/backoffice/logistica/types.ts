export interface TrackingEvent {
  estado: string
  detalle: string | null
  ocurrioEn: string
}

export interface Shipment {
  id: number
  orderId: number
  origenUbicacion: string
  transportista: string
  estado: string
  numeroGuia: string | null
  creadoEn: string
  actualizadoEn: string
  carrierName?: string | null
  driverName?: string | null
  vehiclePlate?: string | null
  transportReason?: string | null
  seguimiento: TrackingEvent[]
}
