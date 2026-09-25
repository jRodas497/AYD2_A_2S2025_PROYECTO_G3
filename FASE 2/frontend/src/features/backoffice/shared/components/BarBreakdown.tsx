interface Fila {
  etiqueta: string
  porcentaje: number
  valor?: string
}

export function BarBreakdown({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  return (
    <div className="bg-white border border-linea rounded p-4">
      <h3 className="text-sm font-medium text-ink mb-3">{titulo}</h3>
      <div className="space-y-3">
        {filas.map((fila) => (
          <div key={fila.etiqueta}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{fila.etiqueta}</span>
              <span className="font-medium text-ink">{fila.valor ?? `${fila.porcentaje}%`}</span>
            </div>
            <div className="h-2 bg-crema rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${fila.porcentaje}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
