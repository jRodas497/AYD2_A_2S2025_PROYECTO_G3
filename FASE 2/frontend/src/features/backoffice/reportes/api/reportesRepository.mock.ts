import type { ReportesRepository } from './reportesRepository'
import type { PeriodoReporte, ReportesData } from '../types'

const LATENCIA_MS = 200

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const MULTIPLICADOR_PERIODO: Record<PeriodoReporte, number> = {
  '30d': 1,
  '90d': 2.8,
  anio: 11,
}

const VENTAS_BASE: VentaBase[] = [
  { mes: 'Ene', monto: 32000 },
  { mes: 'Feb', monto: 38000 },
  { mes: 'Mar', monto: 41000 },
  { mes: 'Abr', monto: 39500 },
  { mes: 'May', monto: 44200 },
  { mes: 'Jun', monto: 45280 },
]

interface VentaBase {
  mes: string
  monto: number
}

function construirReportes(periodo: PeriodoReporte): ReportesData {
  const factor = MULTIPLICADOR_PERIODO[periodo]
  const ventasMensuales = VENTAS_BASE.map((v) => ({ mes: v.mes, monto: Math.round(v.monto * factor) }))
  const totalVentas = ventasMensuales.reduce((suma, v) => suma + v.monto, 0)
  const totalOrdenes = Math.round(128 * factor)

  return {
    metricas: [
      { id: 'ventas', titulo: 'Ventas totales', valor: `Q ${totalVentas.toLocaleString('es-GT')}`, variacionPct: 8.4 },
      { id: 'ordenes', titulo: 'Órdenes', valor: `${totalOrdenes}`, variacionPct: 12 },
      { id: 'ticket', titulo: 'Ticket promedio', valor: `Q ${(totalVentas / totalOrdenes).toFixed(2)}`, variacionPct: 4.2 },
      { id: 'incidencias', titulo: 'Incidencias', valor: `${Math.round(7 * factor)}`, variacionPct: -2.1 },
    ],
    ventasMensuales,
    estadoOrdenes: [
      { estado: 'Pagadas', porcentaje: 62 },
      { estado: 'En envío', porcentaje: 23 },
      { estado: 'Pendientes', porcentaje: 15 },
    ],
    ordenesPorMes: [
      { mes: 'Enero', cantidad: Math.round(48 * factor) },
      { mes: 'Febrero', cantidad: Math.round(62 * factor) },
      { mes: 'Marzo', cantidad: Math.round(75 * factor) },
      { mes: 'Abril', cantidad: Math.round(88 * factor) },
      { mes: 'Mayo', cantidad: Math.round(96 * factor) },
    ],
    inventario: [
      { categoria: 'Disponible', porcentaje: 82 },
      { categoria: 'Reservado', porcentaje: 12 },
      { categoria: 'Bajo stock', porcentaje: 6 },
    ],
  }
}

export const mockReportesRepository: ReportesRepository = {
  async getReportes(periodo) {
    return esperar(construirReportes(periodo))
  },
}
