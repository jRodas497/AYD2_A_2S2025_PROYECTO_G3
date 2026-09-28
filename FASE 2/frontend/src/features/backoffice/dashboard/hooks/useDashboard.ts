import { useEffect, useState } from 'react'
import { httpDashboardRepository } from '../api/dashboardRepository.http'
import type { DashboardData } from '../types'

export function useDashboard() {
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    httpDashboardRepository
      .getDashboard()
      .then((resultado) => {
        if (cancelado) return
        setDatos(resultado)
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el panel')
        setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  return { datos, cargando, error }
}
