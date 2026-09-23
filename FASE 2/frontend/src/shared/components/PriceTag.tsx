interface PriceTagProps {
  original: number
  final: number
  promocion?: string
}

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function PriceTag({ original, final, promocion }: PriceTagProps) {
  const tieneDescuento = final < original

  if (!tieneDescuento) {
    return <span className="text-sm font-semibold text-ink">{formatQ(final)}</span>
  }

  return (
    <div className="text-right">
      <span className="block text-xs text-gray-400 line-through">{formatQ(original)}</span>
      <span className="block text-sm font-semibold text-ok">{formatQ(final)}</span>
      {promocion && <span className="block text-[11px] text-ok">{promocion}</span>}
    </div>
  )
}
