import { StatCard } from '../../shared/components/StatCard'
import { DonutBreakdown } from '../../shared/components/DonutBreakdown'
import { useDashboard } from '../hooks/useDashboard'
import { ETIQUETA_ESTADO } from '../../../orden/estadoLabels'

const CLASE_TONO: Record<'ok' | 'alerta' | 'falla' | 'info', string> = {
  ok: 'text-ok',
  alerta: 'text-alerta',
  falla: 'text-falla',
  info: 'text-blue-700',
}

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function DashboardPage() {
  const { datos, cargando } = useDashboard()

  if (cargando || !datos) return <p className="text-sm text-gray-400">Cargando panel…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Resumen general</h1>
      <p className="text-sm text-gray-500 mb-6">Vista general de las operaciones administrativas</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {datos.stats.map((stat) => (
          <StatCard key={stat.id} titulo={stat.titulo} valor={stat.valor} descripcion={stat.descripcion} tono={stat.tono} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-linea rounded p-4">
          <h2 className="text-sm font-medium text-ink mb-3">Órdenes recientes</h2>
          <div className="divide-y divide-linea">
            {datos.ordenesRecientes.map((orden) => (
              <div key={orden.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium text-ink">{orden.id}</div>
                  <div className="text-xs text-gray-400">{orden.cliente}</div>
                </div>
                <div className="text-xs text-gray-400">{orden.fecha}</div>
                <div className="w-20 text-right">{formatQ(orden.monto)}</div>
                <span className={`w-20 text-right text-xs font-medium ${CLASE_TONO[ETIQUETA_ESTADO[orden.estado].tono]}`}>
                  {ETIQUETA_ESTADO[orden.estado].texto}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DonutBreakdown
          titulo="Estado del inventario"
          segmentos={datos.inventario.map((i) => ({ etiqueta: i.categoria, porcentaje: i.porcentaje, tono: i.tono }))}
        />
      </div>
    </div>
  )
}
