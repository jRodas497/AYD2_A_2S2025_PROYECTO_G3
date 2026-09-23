interface Props {
  motivo: string
  sugerencia?: string
}

export function UnavailableNotice({ motivo, sugerencia }: Props) {
  return (
    <div className="border border-alerta bg-orange-50 rounded p-3 text-sm text-orange-800 mt-3">
      <p className="font-medium mb-1">No se pudo agregar este producto</p>
      <p>{motivo}</p>
      {sugerencia && <p className="mt-2 text-orange-900">Sugerencia: {sugerencia}</p>}
    </div>
  )
}
