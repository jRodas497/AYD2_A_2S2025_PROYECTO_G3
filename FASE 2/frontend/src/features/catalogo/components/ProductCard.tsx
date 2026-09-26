import { Link } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { PriceTag } from '../../../shared/components/PriceTag'
import type { Product } from '../types'

export function ProductCard({ producto }: { producto: Product }) {
  return (
    <Link
      to={`/productos/${producto.id}`}
      className="block bg-white border border-linea rounded p-3 hover:border-brand transition-colors"
    >
      <div className="h-24 bg-gray-100 rounded mb-2" />
      <div className="text-sm font-medium text-ink">{producto.nombre}</div>
      <div className="text-xs text-gray-400 mb-2">{producto.sku}</div>
      <div className="flex justify-between items-center">
        <PriceTag original={producto.precio.original} final={producto.precio.final} promocion={producto.precio.promocion} />
        <Pill tone={producto.disponible ? 'ok' : 'falla'}>
          {producto.disponible ? 'Disponible' : 'Sin existencia'}
        </Pill>
      </div>
    </Link>
  )
}
