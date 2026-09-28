import { useEffect, useState } from 'react'
import { httpReportesRepository } from '../api/reportesRepository.http'
import type { PeriodoReporte, ReportesData } from '../types'

export function useReportes(periodo: PeriodoReporte) {
  const [datos, setDatos] = useState<ReportesData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    httpReportesRepository
      .getReportes(periodo)
      .then((resultado) => {
        if (!cancelado) {
          setDatos(resultado)
          setCargando(false)
        }
      })
      .catch((e) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los reportes')
          setCargando(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [periodo])

  return { datos, cargando, error }
}
