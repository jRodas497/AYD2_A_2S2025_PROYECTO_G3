import { apiFetch as fetch } from '../../../../shared/api/apiFetch'
import type { Shipment } from '../types'
import { manejarRespuesta, NotFoundError } from '../../../../shared/api/httpErrors'

interface BackendTrackingView {
  status: string
  detail: string | null
  occurredAt: string
}

interface BackendShipmentView {
  id: number
  orderId: number
  originLocation: string
  carrier: string
  status: string
  trackingNumber: string | null
  createdAt: string
  updatedAt: string
  carrierName?: string | null
  driverName?: string | null
  vehiclePlate?: string | null
  transportReason?: string | null
  tracking: BackendTrackingView[]
}

function mapear(v: BackendShipmentView): Shipment {
  return {
    ...(v.carrierName !== undefined ? { carrierName: v.carrierName, driverName: v.driverName, vehiclePlate: v.vehiclePlate, transportReason: v.transportReason } : {}),
    id: v.id,
    orderId: v.orderId,
    origenUbicacion: v.originLocation,
    transportista: v.carrier,
    estado: v.status,
    numeroGuia: v.trackingNumber,
    creadoEn: v.createdAt,
    actualizadoEn: v.updatedAt,
    seguimiento: v.tracking.map((t) => ({ estado: t.status, detalle: t.detail, ocurrioEn: t.occurredAt })),
  }
}

export const httpShipmentsRepository = {
  async byStatus(status: string, limit = 50): Promise<Shipment[]> {
    const lista = await manejarRespuesta<BackendShipmentView[]>(
      await fetch(`/api/shipments?status=${encodeURIComponent(status)}&limit=${limit}`),
    )
    return lista.map(mapear)
  },

  async byId(id: number): Promise<Shipment> {
    return mapear(await manejarRespuesta<BackendShipmentView>(await fetch(`/api/shipments/${id}`)))
  },

  async byOrder(orderId: string): Promise<Shipment | null> {
    try {
      return mapear(await manejarRespuesta<BackendShipmentView>(await fetch(`/api/orders/${orderId}/shipment`)))
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },

  async requestGuide(id: number): Promise<Shipment> {
    return mapear(
      await manejarRespuesta<BackendShipmentView>(await fetch(`/api/shipments/${id}/guide`, { method: 'POST' })),
    )
  },

  async reassignOrigin(id: number, locationCode: string): Promise<Shipment> {
    return mapear(
      await manejarRespuesta<BackendShipmentView>(
        await fetch(`/api/shipments/${id}/origin`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationCode }),
        }),
      ),
    )
  },

  async addTracking(id: number, status: string, detail: string): Promise<Shipment> {
    return mapear(
      await manejarRespuesta<BackendShipmentView>(
        await fetch(`/api/shipments/${id}/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, detail }),
        }),
      ),
    )
  },
}
