import type { PeriodoReporte, ReportesData } from '../types'

export interface ReportesRepository {
  getReportes(periodo: PeriodoReporte): Promise<ReportesData>
}
