import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { authHeaders } from '../../../../shared/context/AuthContext'

export interface NotificacionAdmin {
  id: number
  orderId: number
  channel: string
  status: 'PENDING' | 'DELIVERED' | 'FAILED'
  recipient: string
  message: string
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
}

export const httpNotificacionesAdminRepository = {
  async byStatus(status: string, limit = 50): Promise<NotificacionAdmin[]> {
    return manejarRespuesta<NotificacionAdmin[]>(await fetch(`/api/notifications?status=${status}&limit=${limit}`))
  },

  async retry(id: number): Promise<NotificacionAdmin> {
    return manejarRespuesta<NotificacionAdmin>(
      await fetch(`/api/notifications/${id}/retry`, { method: 'POST', headers: authHeaders() }),
    )
  },
}
