export interface DashboardStat {
  id: string
  titulo: string
  valor: string
  descripcion: string
  tono: 'ok' | 'alerta' | 'falla' | 'info'
}

export interface OrdenReciente {
  id: string
  cliente: string
  fecha: string
  monto: number
  estado: 'pagada' | 'envio' | 'pendiente'
}

export interface InventarioResumen {
  categoria: string
  porcentaje: number
  tono: 'ok' | 'alerta' | 'falla'
}

export interface DashboardData {
  stats: DashboardStat[]
  ordenesRecientes: OrdenReciente[]
  inventario: InventarioResumen[]
}
