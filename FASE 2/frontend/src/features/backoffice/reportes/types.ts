export type PeriodoReporte = '30d' | '90d' | 'anio'

export interface MetricaReporte {
  id: string
  titulo: string
  valor: string
  variacionPct: number
}

export interface VentaMensual {
  mes: string
  monto: number
}

export interface DistribucionEstadoOrdenes {
  estado: string
  porcentaje: number
}

export interface OrdenesPorMes {
  mes: string
  cantidad: number
}

export interface InventarioPorcentaje {
  categoria: string
  porcentaje: number
}

export interface ReportesData {
  metricas: MetricaReporte[]
  ventasMensuales: VentaMensual[]
  estadoOrdenes: DistribucionEstadoOrdenes[]
  ordenesPorMes: OrdenesPorMes[]
  inventario: InventarioPorcentaje[]
}
