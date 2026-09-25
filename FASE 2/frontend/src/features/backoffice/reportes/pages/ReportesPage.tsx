import { useState } from 'react'
import { StatCard } from '../../shared/components/StatCard'
import { BarBreakdown } from '../../shared/components/BarBreakdown'
import { useReportes } from '../hooks/useReportes'
import { VentasChart } from '../components/VentasChart'
import type { PeriodoReporte } from '../types'

const OPCIONES_PERIODO: { valor: PeriodoReporte; etiqueta: string }[] = [
  { valor: '30d', etiqueta: 'Últimos 30 días' },
  { valor: '90d', etiqueta: 'Últimos 90 días' },
  { valor: 'anio', etiqueta: 'Este año' },
]

function tonoVariacion(pct: number): 'ok' | 'falla' {
  return pct >= 0 ? 'ok' : 'falla'
}

function formatVariacion(pct: number): string {
  const flecha = pct >= 0 ? '↑' : '↓'
  return `${flecha} ${Math.abs(pct)}%`
}

export function ReportesPage() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('30d')
  const { datos, cargando } = useReportes(periodo)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Reportes y métricas</h1>
          <p className="text-sm text-gray-500">Análisis general del comportamiento de las operaciones</p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as PeriodoReporte)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          {OPCIONES_PERIODO.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {cargando || !datos ? (
        <p className="text-sm text-gray-400">Cargando reportes…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {datos.metricas.map((m) => (
              <StatCard
                key={m.id}
                titulo={m.titulo}
                valor={m.valor}
                descripcion={formatVariacion(m.variacionPct)}
                tono={tonoVariacion(m.variacionPct)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <VentasChart ventas={datos.ventasMensuales} />
            <BarBreakdown
              titulo="Estado de órdenes"
              filas={datos.estadoOrdenes.map((e) => ({ etiqueta: e.estado, porcentaje: e.porcentaje }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <BarBreakdown
              titulo="Órdenes por mes"
              filas={datos.ordenesPorMes.map((o) => ({ etiqueta: o.mes, porcentaje: Math.round((o.cantidad / Math.max(...datos.ordenesPorMes.map((x) => x.cantidad))) * 100), valor: `${o.cantidad}` }))}
            />
            <BarBreakdown
              titulo="Estado del inventario"
              filas={datos.inventario.map((i) => ({ etiqueta: i.categoria, porcentaje: i.porcentaje }))}
            />
          </div>
        </>
      )}
    </div>
  )
}
