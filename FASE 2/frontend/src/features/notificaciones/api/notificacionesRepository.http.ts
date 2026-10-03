import { manejarRespuesta } from '../../../shared/api/httpErrors'
import type { NotificacionCliente } from '../types'

interface BackendOrderOverview {
  orderId: number
}

interface BackendNotification {
  id: number
  orderId: number
  channel: string
  status: string
  message: string
  createdAt: string
  sentAt: string | null
}

export const httpNotificacionesRepository = {
  /**
   * No existe un endpoint de "mis notificaciones" (el backend solo las expone por orden o por
   * estado global). Se arma aquí, a partir de las órdenes reales del cliente, sin inventar datos.
   */
  async misNotificaciones(customerId: string, limiteOrdenes = 20): Promise<NotificacionCliente[]> {
    const ordenes = await manejarRespuesta<BackendOrderOverview[]>(
      await fetch(`/api/customers/${customerId}/orders?limit=${limiteOrdenes}`),
    )
    const porOrden = await Promise.all(
      ordenes.map(async (o) => {
        try {
          return await manejarRespuesta<BackendNotification[]>(await fetch(`/api/orders/${o.orderId}/notifications`))
        } catch {
          return [] as BackendNotification[]
        }
      }),
    )
    return porOrden
      .flat()
      .map((n) => ({
        id: n.id,
        orderId: n.orderId,
        canal: n.channel,
        estado: n.status as NotificacionCliente['estado'],
        mensaje: n.message,
        creadaEn: n.createdAt,
        enviadaEn: n.sentAt,
      }))
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  },
}
