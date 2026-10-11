import { Link } from 'react-router-dom'
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

function formatFecha(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
}

export function DashboardPage() {
  const { datos, cargando, error } = useDashboard()

  if (cargando || !datos) return <p className="text-sm text-gray-400">Cargando panel…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Resumen general</h1>
      <p className="text-sm text-gray-500 mb-6">Vista general de las operaciones administrativas, sobre datos reales.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {datos.stats.map((stat) => (
          <StatCard key={stat.id} titulo={stat.titulo} valor={stat.valor} descripcion={stat.descripcion} tono={stat.tono} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-linea rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-ink">Órdenes recientes</h2>
            <Link to="/administracion/ordenes" className="text-xs text-brand hover:underline">
              Ver todas
            </Link>
          </div>
          {datos.ordenesRecientes.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay órdenes registradas.</p>
          ) : (
            <div className="divide-y divide-linea">
              {datos.ordenesRecientes.map((orden) => (
                <Link
                  key={orden.id}
                  to={`/administracion/ordenes/${orden.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-crema/40"
                >
                  <div>
                    <div className="font-medium text-ink">Orden {orden.id}</div>
                    <div className="text-xs text-gray-400">{orden.cliente}</div>
                  </div>
                  <div className="text-xs text-gray-400">{formatFecha(orden.fecha)}</div>
                  <div className="w-20 text-right">{formatQ(orden.monto)}</div>
                  <span className={`w-24 text-right text-xs font-medium ${CLASE_TONO[ETIQUETA_ESTADO[orden.estado].tono]}`}>
                    {ETIQUETA_ESTADO[orden.estado].texto}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <DonutBreakdown
          titulo="Estado de órdenes (30 días)"
          segmentos={datos.estadoOrdenes.map((e) => ({ etiqueta: e.estado, porcentaje: e.porcentaje, tono: e.tono }))}
        />
      </div>
    </div>
  )
}
