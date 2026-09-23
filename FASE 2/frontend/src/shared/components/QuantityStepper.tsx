interface QuantityStepperProps {
  cantidad: number
  onDecrementar: () => void
  onIncrementar: () => void
  min?: number
  etiqueta?: string
}

export function QuantityStepper({ cantidad, onDecrementar, onIncrementar, min = 1, etiqueta }: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center border border-linea rounded">
      <button
        type="button"
        onClick={onDecrementar}
        disabled={cantidad <= min}
        className="w-8 h-8 flex items-center justify-center text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-crema"
        aria-label={etiqueta ? `Disminuir cantidad de ${etiqueta}` : 'Disminuir cantidad'}
      >
        −
      </button>
      <span className="w-8 text-center text-sm">{cantidad}</span>
      <button
        type="button"
        onClick={onIncrementar}
        className="w-8 h-8 flex items-center justify-center text-ink hover:bg-crema"
        aria-label={etiqueta ? `Aumentar cantidad de ${etiqueta}` : 'Aumentar cantidad'}
      >
        +
      </button>
    </div>
  )
}
