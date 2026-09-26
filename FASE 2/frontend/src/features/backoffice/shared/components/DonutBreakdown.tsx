const TONO_COLOR: Record<'ok' | 'alerta' | 'falla', string> = {
  ok: '#2e7d32',
  alerta: '#ef6c00',
  falla: '#c62828',
}

interface Segmento {
  etiqueta: string
  porcentaje: number
  tono: 'ok' | 'alerta' | 'falla'
}

function construirGradiente(segmentos: Segmento[]): string {
  let acumulado = 0
  const partes = segmentos.map((s) => {
    const inicio = acumulado
    acumulado += s.porcentaje
    return `${TONO_COLOR[s.tono]} ${inicio}% ${acumulado}%`
  })
  return `conic-gradient(${partes.join(', ')})`
}

export function DonutBreakdown({ titulo, segmentos }: { titulo: string; segmentos: Segmento[] }) {
  const total = segmentos.reduce((suma, s) => suma + s.porcentaje, 0)
  return (
    <div className="bg-white border border-linea rounded p-4">
      <h3 className="text-sm font-medium text-ink mb-3">{titulo}</h3>
      <div className="flex items-center gap-6">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: construirGradiente(segmentos) }}
        >
          <div className="w-14 h-14 bg-white rounded-full flex flex-col items-center justify-center">
            <strong className="text-sm text-ink">{total}%</strong>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {segmentos.map((s) => (
            <li key={s.etiqueta} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONO_COLOR[s.tono] }} />
              <span className="text-gray-600">{s.etiqueta}</span>
              <span className="font-medium text-ink">{s.porcentaje}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
