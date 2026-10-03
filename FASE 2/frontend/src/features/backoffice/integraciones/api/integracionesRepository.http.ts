import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { authHeaders } from '../../../../shared/context/AuthContext'
import type { OutboxEventoVista, PosEventoVista, SaludIntegraciones } from '../types'

export const httpIntegracionesRepository = {
  async salud(): Promise<SaludIntegraciones> {
    return manejarRespuesta<SaludIntegraciones>(await fetch('/api/integration/health'))
  },

  async outbox(status: string, limit = 50): Promise<OutboxEventoVista[]> {
    return manejarRespuesta<OutboxEventoVista[]>(
      await fetch(`/api/integration/outbox?status=${status}&limit=${limit}`),
    )
  },

  async reintentarOutbox(id: number): Promise<void> {
    await manejarRespuesta(await fetch(`/api/integration/outbox/${id}/retry`, { method: 'POST', headers: authHeaders() }))
  },

  async pos(status: string, limit = 50): Promise<PosEventoVista[]> {
    return manejarRespuesta<PosEventoVista[]>(
      await fetch(`/api/integration/pos/events?status=${status}&limit=${limit}`),
    )
  },

  async reintentarPos(id: number): Promise<void> {
    await manejarRespuesta(
      await fetch(`/api/integration/pos/events/${id}/retry`, { method: 'POST', headers: authHeaders() }),
    )
  },

  async erpBatches(limit = 20): Promise<Record<string, unknown>[]> {
    return manejarRespuesta<Record<string, unknown>[]>(await fetch(`/api/integration/erp/batches?limit=${limit}`))
  },

  async generarLoteErp(): Promise<void> {
    await manejarRespuesta(await fetch('/api/integration/erp/batches', { method: 'POST', headers: authHeaders() }))
  },

  async reintentarErp(id: number): Promise<void> {
    await manejarRespuesta(
      await fetch(`/api/integration/erp/batches/${id}/retry`, { method: 'POST', headers: authHeaders() }),
    )
  },
}
