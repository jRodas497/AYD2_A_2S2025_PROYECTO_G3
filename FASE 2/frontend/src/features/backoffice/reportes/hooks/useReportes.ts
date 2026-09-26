import { useEffect, useState } from 'react'
import { mockReportesRepository } from '../api/reportesRepository.mock'
import type { PeriodoReporte, ReportesData } from '../types'

export function useReportes(periodo: PeriodoReporte) {
  const [datos, setDatos] = useState<ReportesData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    mockReportesRepository.getReportes(periodo).then((resultado) => {
      if (!cancelado) {
        setDatos(resultado)
        setCargando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [periodo])

  return { datos, cargando }
}
