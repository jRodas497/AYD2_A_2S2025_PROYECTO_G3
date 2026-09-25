import { describe, expect, it } from 'vitest'
import { mockReportesRepository } from './reportesRepository.mock'

describe('mockReportesRepository', () => {
  it('resuelve con métricas, ventas, estados, órdenes por mes e inventario no vacíos', async () => {
    const data = await mockReportesRepository.getReportes('30d')
    expect(data.metricas.length).toBeGreaterThan(0)
    expect(data.ventasMensuales.length).toBeGreaterThan(0)
    expect(data.estadoOrdenes.length).toBeGreaterThan(0)
    expect(data.ordenesPorMes.length).toBeGreaterThan(0)
    expect(data.inventario.length).toBeGreaterThan(0)
  })

  it('cambiar el período cambia las ventas totales (el selector no es decorativo)', async () => {
    const treintaDias = await mockReportesRepository.getReportes('30d')
    const noventaDias = await mockReportesRepository.getReportes('90d')
    const anio = await mockReportesRepository.getReportes('anio')

    const totalVentas = (data: typeof treintaDias) => data.ventasMensuales.reduce((suma, v) => suma + v.monto, 0)

    expect(totalVentas(noventaDias)).toBeGreaterThan(totalVentas(treintaDias))
    expect(totalVentas(anio)).toBeGreaterThan(totalVentas(noventaDias))
  })
})
