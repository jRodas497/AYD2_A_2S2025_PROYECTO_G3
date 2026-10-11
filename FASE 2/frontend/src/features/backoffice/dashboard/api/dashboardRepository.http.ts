import { apiFetch as fetch } from '../../../../shared/api/apiFetch'
import type { DashboardRepository } from './dashboardRepository'
import type { DashboardData } from '../types'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { mapearEstado } from '../../../orden/api/orderRepository.http'

interface BackendOrderOverview {
  orderId: number
  createdAt: string | null
  customer: string
  status: string
  total: number
}

interface BackendSalesReport {
  total: { ordenes: number; monto: number }
  byStatus: { estado: string; ordenes: number; monto: number }[]
}

interface BackendIncident {
  id: number
}

interface BackendReservation {
  id: number
}

const TONO_ESTADO: Record<string, 'ok' | 'alerta' | 'falla'> = {
  PENDING_PAYMENT: 'alerta',
  PAYMENT_IN_PROGRESS: 'alerta',
  PAYMENT_FAILED: 'falla',
  PAID: 'ok',
  INVOICED: 'ok',
  IN_DISPATCH: 'ok',
  DELIVERED: 'ok',
  CANCELLED: 'falla',
  RETURNED: 'falla',
}

function formatQ(valor: number): string {
  return `Q ${valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const httpDashboardRepository: DashboardRepository = {
  async getDashboard() {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000)
    const params = new URLSearchParams({ from: desde.toISOString(), to: hasta.toISOString() })

    const [ventas, ordenesRecientesResp, incidenciasRegistradas, incidenciasEnProceso, reservasActivas] =
      await Promise.all([
        manejarRespuesta<BackendSalesReport>(await fetch(`/api/reports/sales?${params.toString()}`)),
        manejarRespuesta<BackendOrderOverview[]>(await fetch('/api/orders?limit=5')),
        manejarRespuesta<BackendIncident[]>(await fetch('/api/incidents?status=REGISTERED&limit=200')),
        manejarRespuesta<BackendIncident[]>(await fetch('/api/incidents?status=IN_PROCESS&limit=200')),
        manejarRespuesta<BackendReservation[]>(await fetch('/api/inventory/reservations?status=ACTIVE&limit=200')),
      ])

    const incidenciasAbiertas = incidenciasRegistradas.length + incidenciasEnProceso.length
    const totalOrdenes = ventas.total.ordenes || 1

    const datos: DashboardData = {
      stats: [
        {
          id: 'ventas',
          titulo: 'Ventas (30 días)',
          valor: formatQ(ventas.total.monto),
          descripcion: `${ventas.total.ordenes} órdenes`,
          tono: 'info',
        },
        {
          id: 'ordenes',
          titulo: 'Órdenes (30 días)',
          valor: `${ventas.total.ordenes}`,
          descripcion: 'en los últimos 30 días',
          tono: 'info',
        },
        {
          id: 'incidencias',
          titulo: 'Incidencias abiertas',
          valor: `${incidenciasAbiertas}`,
          descripcion: incidenciasAbiertas > 0 ? 'requieren atención' : 'ninguna pendiente',
          tono: incidenciasAbiertas > 0 ? 'alerta' : 'ok',
        },
        {
          id: 'reservas',
          titulo: 'Reservas activas',
          valor: `${reservasActivas.length}`,
          descripcion: 'stock apartado por checkouts en curso',
          tono: 'info',
        },
      ],
      ordenesRecientes: ordenesRecientesResp.map((o) => ({
        id: String(o.orderId),
        cliente: o.customer,
        fecha: o.createdAt ?? '',
        monto: o.total,
        estado: mapearEstado(o.status),
      })),
      estadoOrdenes: ventas.byStatus.map((s) => ({
        estado: s.estado,
        porcentaje: Math.round((s.ordenes / totalOrdenes) * 100),
        tono: TONO_ESTADO[s.estado] ?? 'ok',
      })),
    }
    return datos
  },
}
