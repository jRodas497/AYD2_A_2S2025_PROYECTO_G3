import type { OrderRepository } from './orderRepository'
import type { EstadoOrden, Order } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'
import { listarIdsOrdenes, registrarOrden } from './orderIndex'
import { guardarSnapshot, obtenerSnapshot } from './orderItemsSnapshot'

interface BackendOrder {
  id: number
  cartId: number | null
  customerId: number
  channel: string
  status: string
  total: number
  deliveryAddress: string
  createdAt: string | null
  updatedAt: string
}

interface BackendOrderDetail {
  orderId: number
  createdAt: string | null
  customerId: number
  customer: string
  channel: string
  status: string
  total: number
  lastPaymentResult: string | null
  paymentAttempts: number | null
  invoiceStatus: string | null
  shipmentStatus: string | null
  trackingNumber: string | null
}

const MAPA_ESTADO: Record<string, EstadoOrden> = {
  PENDING_PAYMENT: 'pendiente_pago',
  PAYMENT_IN_PROGRESS: 'pago_en_proceso',
  PAYMENT_FAILED: 'pago_fallido',
  PAID: 'pagada',
  INVOICED: 'facturada',
  IN_DISPATCH: 'en_despacho',
  DELIVERED: 'entregada',
  CANCELLED: 'cancelada',
  RETURNED: 'devuelta',
}

function mapearEstado(status: string): EstadoOrden {
  return MAPA_ESTADO[status] ?? 'pendiente_pago'
}

export const httpOrderRepository: OrderRepository = {
  async createOrder(input) {
    const backendOrder = await manejarRespuesta<BackendOrder>(
      await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: Number(input.customerId), deliveryAddress: input.direccionEntrega }),
      }),
    )
    const orden: Order = {
      id: String(backendOrder.id),
      customerId: input.customerId,
      items: input.items,
      total: backendOrder.total,
      direccionEntrega: backendOrder.deliveryAddress,
      estado: mapearEstado(backendOrder.status),
      // createdAt sale null en la respuesta de checkout (limitación conocida del backend) — se
      // usa updatedAt como fecha de creación para este caso puntual.
      creadaEn: backendOrder.updatedAt,
    }
    guardarSnapshot(orden.id, { items: input.items, direccionEntrega: input.direccionEntrega })
    registrarOrden(input.customerId, orden.id)
    return orden
  },

  async getOrder(id) {
    try {
      const detalle = await manejarRespuesta<BackendOrderDetail>(await fetch(`/api/orders/${id}`))
      const snapshot = obtenerSnapshot(id)
      return {
        id: String(detalle.orderId),
        customerId: String(detalle.customerId),
        items: snapshot?.items ?? [],
        total: detalle.total,
        direccionEntrega: snapshot?.direccionEntrega ?? '',
        estado: mapearEstado(detalle.status),
        creadaEn: detalle.createdAt ?? '',
        trackingNumber: detalle.trackingNumber ?? undefined,
      }
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },

  async updateEstado() {
    throw new Error('El estado de la orden lo controla el backend real; no se puede forzar desde el frontend')
  },

  async listOrders(customerId) {
    const ids = listarIdsOrdenes(customerId)
    const ordenes = await Promise.all(ids.map((id) => httpOrderRepository.getOrder(id)))
    return ordenes.filter((o): o is Order => o !== null).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  },
}
