import type { ReportesRepository } from './reportesRepository'
import type { PeriodoReporte, VentaMensual } from '../types'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'

interface BackendSalesTotal {
  ordenes: number
  monto: number
}

interface BackendReconciliation {
  facturadas: number
  monto_facturado: number
  entregadas_al_erp: number
  monto_entregado_al_erp: number
  en_lote_pendiente: number
  facturadas_sin_lote: number
  monto_sin_lote: number
  cuadra: boolean
}

interface BackendChannelRow {
  canal: string
  ordenes: number
  monto: number
}

interface BackendStatusRow {
  estado: string
  ordenes: number
  monto: number
}

interface BackendSalesReport {
  from: string
  to: string
  total: BackendSalesTotal
  reconciliation: BackendReconciliation
  byChannel: BackendChannelRow[]
  byStatus: BackendStatusRow[]
}

interface BackendPaymentRow {
  attempted_at: string
  order_id: number
  channel: string
  result: string
  amount: number
}

const RANGO_DIAS: Record<PeriodoReporte, number> = { '30d': 30, '90d': 90, anio: 365 }
const MESES_TENDENCIA = 6
const DIA_MS = 24 * 60 * 60 * 1000

function formatQ(valor: number): string {
  return `Q ${valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function consultarVentas(desde: Date, hasta: Date): Promise<BackendSalesReport> {
  const params = new URLSearchParams({ from: desde.toISOString(), to: hasta.toISOString() })
  return manejarRespuesta<BackendSalesReport>(await fetch(`/api/reports/sales?${params.toString()}`))
}

async function tendenciaMensual(): Promise<VentaMensual[]> {
  const ahora = new Date()
  const rangos = Array.from({ length: MESES_TENDENCIA }, (_, i) => {
    const offset = MESES_TENDENCIA - 1 - i
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() - offset + 1, 1)
    return { inicio, fin }
  })
  const reportes = await Promise.all(rangos.map((r) => consultarVentas(r.inicio, r.fin)))
  return rangos.map((r, i) => ({
    mes: r.inicio.toLocaleDateString('es-GT', { month: 'short' }),
    monto: reportes[i].total.monto,
  }))
}

export const httpReportesRepository: ReportesRepository = {
  async getReportes(periodo) {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - RANGO_DIAS[periodo] * DIA_MS)

    const [reporte, tendencia, pagosResponse] = await Promise.all([
      consultarVentas(desde, hasta),
      tendenciaMensual(),
      fetch('/api/reports/payments?limit=10'),
    ])
    const pagos = await manejarRespuesta<BackendPaymentRow[]>(pagosResponse)

    const totalOrdenes = reporte.total.ordenes || 1

    return {
      metricas: [
        {
          id: 'ventas',
          titulo: 'Ventas totales',
          valor: formatQ(reporte.total.monto),
          descripcion: `${reporte.total.ordenes} órdenes en el periodo`,
        },
        {
          id: 'ticket',
          titulo: 'Ticket promedio',
          valor: formatQ(reporte.total.monto / totalOrdenes),
          descripcion: 'por orden en el periodo',
        },
        {
          id: 'facturadas',
          titulo: 'Facturadas',
          valor: `${reporte.reconciliation.facturadas}`,
          descripcion: formatQ(reporte.reconciliation.monto_facturado),
        },
        {
          id: 'erp',
          titulo: 'Entregadas al ERP',
          valor: `${reporte.reconciliation.entregadas_al_erp}`,
          descripcion: reporte.reconciliation.cuadra
            ? 'cuadra con lo facturado'
            : `${reporte.reconciliation.facturadas_sin_lote} facturadas, sin lote todavía`,
        },
      ],
      ventasMensuales: tendencia,
      estadoOrdenes: reporte.byStatus.map((s) => ({
        estado: s.estado,
        ordenes: s.ordenes,
        porcentaje: Math.round((s.ordenes / totalOrdenes) * 100),
      })),
      porCanal: reporte.byChannel.map((c) => ({ canal: c.canal, ordenes: c.ordenes, monto: c.monto })),
      pagosRecientes: pagos.map((p) => ({
        orderId: p.order_id,
        canal: p.channel,
        resultado: p.result,
        monto: p.amount,
        fecha: p.attempted_at,
      })),
    }
  },
}
