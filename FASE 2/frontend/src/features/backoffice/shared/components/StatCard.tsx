const TONO_ESTILOS: Record<'ok' | 'alerta' | 'falla' | 'info', { punto: string; texto: string }> = {
  ok: { punto: 'bg-ok', texto: 'text-ok' },
  alerta: { punto: 'bg-alerta', texto: 'text-alerta' },
  falla: { punto: 'bg-falla', texto: 'text-falla' },
  info: { punto: 'bg-blue-600', texto: 'text-blue-700' },
}

interface StatCardProps {
  titulo: string
  valor: string
  descripcion: string
  tono: 'ok' | 'alerta' | 'falla' | 'info'
}

export function StatCard({ titulo, valor, descripcion, tono }: StatCardProps) {
  const estilos = TONO_ESTILOS[tono]
  return (
    <div className="bg-white border border-linea rounded p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500">{titulo}</span>
        <span className={`w-2 h-2 rounded-full mt-1 ${estilos.punto}`} />
      </div>
      <div className="text-2xl font-semibold text-ink mb-1">{valor}</div>
      <div className={`text-xs ${estilos.texto}`}>{descripcion}</div>
    </div>
  )
}
