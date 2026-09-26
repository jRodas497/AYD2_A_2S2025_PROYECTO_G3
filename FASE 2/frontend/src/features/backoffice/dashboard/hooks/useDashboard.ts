import { useEffect, useState } from 'react'
import { mockDashboardRepository } from '../api/dashboardRepository.mock'
import type { DashboardData } from '../types'

export function useDashboard() {
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    mockDashboardRepository.getDashboard().then((resultado) => {
      if (cancelado) return
      setDatos(resultado)
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

  return { datos, cargando }
}
