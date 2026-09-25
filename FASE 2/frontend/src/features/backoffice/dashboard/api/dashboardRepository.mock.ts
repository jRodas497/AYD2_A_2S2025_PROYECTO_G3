import type { DashboardRepository } from './dashboardRepository'
import type { DashboardData } from '../types'

const LATENCIA_MS = 200

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const DASHBOARD_MOCK: DashboardData = {
  stats: [
    { id: 'ordenes', titulo: 'Órdenes', valor: '128', descripcion: '+12% este mes', tono: 'info' },
    { id: 'ventas', titulo: 'Ventas', valor: 'Q 45,280.00', descripcion: '+8.4% este mes', tono: 'ok' },
    { id: 'pendientes', titulo: 'Pendientes', valor: '24', descripcion: 'Requieren atención', tono: 'alerta' },
    { id: 'incidencias', titulo: 'Incidencias', valor: '7', descripcion: '3 sin resolver', tono: 'falla' },
  ],
  ordenesRecientes: [
    { id: 'ORD-1024', cliente: 'Carlos López', fecha: '23 sep 2026', monto: 1250, estado: 'pagada' },
    { id: 'ORD-1023', cliente: 'María García', fecha: '23 sep 2026', monto: 850, estado: 'envio' },
    { id: 'ORD-1022', cliente: 'José Martínez', fecha: '22 sep 2026', monto: 2100, estado: 'pendiente' },
    { id: 'ORD-1021', cliente: 'Ana Rodríguez', fecha: '22 sep 2026', monto: 640, estado: 'pagada' },
  ],
  inventario: [
    { categoria: 'Disponible', porcentaje: 82, tono: 'ok' },
    { categoria: 'Reservado', porcentaje: 12, tono: 'alerta' },
    { categoria: 'Bajo stock', porcentaje: 6, tono: 'falla' },
  ],
}

export const mockDashboardRepository: DashboardRepository = {
  async getDashboard() {
    return esperar(DASHBOARD_MOCK)
  },
}
