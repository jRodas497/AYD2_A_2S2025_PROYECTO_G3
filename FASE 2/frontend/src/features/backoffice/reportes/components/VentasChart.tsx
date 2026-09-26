import type { VentaMensual } from '../types'

function formatQCorto(valor: number): string {
  if (valor >= 1000) return `Q${Math.round(valor / 1000)}K`
  return `Q${valor}`
}

export function VentasChart({ ventas }: { ventas: VentaMensual[] }) {
  const maximo = Math.max(...ventas.map((v) => v.monto))

  return (
    <div className="bg-white border border-linea rounded p-4">
      <h3 className="text-sm font-medium text-ink mb-4">Ventas mensuales</h3>
      <div className="flex items-end gap-3 h-40">
        {ventas.map((v) => (
          <div key={v.mes} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] text-gray-400 mb-1">{formatQCorto(v.monto)}</span>
            <div
              className="w-full bg-brand rounded-t"
              style={{ height: `${(v.monto / maximo) * 100}%` }}
            />
            <span className="text-xs text-gray-500 mt-1.5">{v.mes}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
