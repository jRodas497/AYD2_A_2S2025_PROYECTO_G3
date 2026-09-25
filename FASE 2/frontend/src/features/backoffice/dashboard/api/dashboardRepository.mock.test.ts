import { describe, expect, it } from 'vitest'
import { mockDashboardRepository } from './dashboardRepository.mock'

describe('mockDashboardRepository', () => {
  it('resuelve con stats, órdenes recientes e inventario no vacíos', async () => {
    const data = await mockDashboardRepository.getDashboard()
    expect(data.stats.length).toBeGreaterThan(0)
    expect(data.ordenesRecientes.length).toBeGreaterThan(0)
    expect(data.inventario.length).toBeGreaterThan(0)
  })

  it('el inventario suma 100%', async () => {
    const data = await mockDashboardRepository.getDashboard()
    const total = data.inventario.reduce((suma, i) => suma + i.porcentaje, 0)
    expect(total).toBe(100)
  })
})
