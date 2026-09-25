import { useEffect, useState } from 'react'
import { mockDashboardRepository } from '../api/dashboardRepository.mock'
import type { DashboardData } from '../types'

export function useDashboard() {
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    mockDashboardRepository.getDashboard().then((resultado) => {
      setDatos(resultado)
      setCargando(false)
    })
  }, [])

  return { datos, cargando }
}
