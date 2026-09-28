export type PeriodoReporte = '30d' | '90d' | 'anio'

export interface MetricaReporte {
  id: string
  titulo: string
  valor: string
  descripcion: string
}

export interface VentaMensual {
  mes: string
  monto: number
}

export interface DistribucionEstadoOrdenes {
  estado: string
  porcentaje: number
  ordenes: number
}

export interface VentasPorCanal {
  canal: string
  ordenes: number
  monto: number
}

export interface PagoReciente {
  orderId: number
  canal: string
  resultado: string
  monto: number
  fecha: string
}

export interface ReportesData {
  metricas: MetricaReporte[]
  ventasMensuales: VentaMensual[]
  estadoOrdenes: DistribucionEstadoOrdenes[]
  porCanal: VentasPorCanal[]
  pagosRecientes: PagoReciente[]
}
