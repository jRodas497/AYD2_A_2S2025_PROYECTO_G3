import { useState } from 'react'
import { StatCard } from '../../shared/components/StatCard'
import { BarBreakdown } from '../../shared/components/BarBreakdown'
import { Pill } from '../../../../shared/components/Pill'
import { useReportes } from '../hooks/useReportes'
import { VentasChart } from '../components/VentasChart'
import type { PeriodoReporte } from '../types'

const OPCIONES_PERIODO: { valor: PeriodoReporte; etiqueta: string }[] = [
  { valor: '30d', etiqueta: 'Últimos 30 días' },
  { valor: '90d', etiqueta: 'Últimos 90 días' },
  { valor: 'anio', etiqueta: 'Este año' },
]

const TONO_RESULTADO: Record<string, 'ok' | 'alerta' | 'falla' | 'info'> = {
  APPROVED: 'ok',
  DECLINED: 'falla',
  TIMEOUT: 'alerta',
  ERROR: 'alerta',
}

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ReportesPage() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('30d')
  const { datos, cargando, error } = useReportes(periodo)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Reportes y métricas</h1>
          <p className="text-sm text-gray-500">Ventas, conciliación fiscal y cobros, calculados sobre la base real.</p>
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
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {datos.metricas.map((m) => (
              <StatCard key={m.id} titulo={m.titulo} valor={m.valor} descripcion={m.descripcion} tono="info" />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <VentasChart ventas={datos.ventasMensuales} />
            <BarBreakdown
              titulo="Estado de órdenes en el periodo"
              filas={datos.estadoOrdenes.map((e) => ({
                etiqueta: e.estado,
                porcentaje: e.porcentaje,
                valor: `${e.ordenes}`,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <BarBreakdown
              titulo="Ventas por canal"
              filas={datos.porCanal.map((c) => ({
                etiqueta: c.canal,
                porcentaje: Math.round((c.monto / Math.max(1, ...datos.porCanal.map((x) => x.monto))) * 100),
                valor: formatQ(c.monto),
              }))}
            />
          </div>

          <div className="bg-white border border-linea rounded p-4">
            <h3 className="text-sm font-medium text-ink mb-3">Cobros recientes</h3>
            {datos.pagosRecientes.length === 0 ? (
              <p className="text-sm text-gray-400">Sin intentos de cobro registrados todavía.</p>
            ) : (
              <div className="divide-y divide-linea">
                {datos.pagosRecientes.map((p, i) => (
                  <div key={`${p.orderId}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-ink">Orden {p.orderId}</span>
                    <span className="text-xs text-gray-400">{p.canal}</span>
                    <span className="text-xs text-gray-400">{formatFecha(p.fecha)}</span>
                    <span className="w-20 text-right">{formatQ(p.monto)}</span>
                    <Pill tone={TONO_RESULTADO[p.resultado] ?? 'info'}>{p.resultado}</Pill>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
