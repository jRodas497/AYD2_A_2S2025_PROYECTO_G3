import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { PriceTag } from '../../../shared/components/PriceTag'
import { Button } from '../../../shared/components/Button'
import { BackLink } from '../../../shared/components/BackLink'
import { useProducto } from '../hooks/useCatalogo'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { UnavailableNotice } from '../../carrito/components/UnavailableNotice'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { producto, cargando } = useProducto(id)
  const { agregarProducto } = useCarrito()
  const [error, setError] = useState<string | null>(null)
  const [agregado, setAgregado] = useState(false)

  if (cargando) return <p className="text-sm text-gray-400">Cargando producto…</p>
  if (!producto) return <p className="text-sm text-falla">Producto no encontrado.</p>

  async function handleAgregar() {
    if (!producto) return
    setError(null)
    setAgregado(false)
    const resultado = await agregarProducto(producto)
    if (resultado.ok) {
      setAgregado(true)
    } else {
      setError(resultado.motivo)
    }
  }

  return (
    <div>
      <BackLink to="/catalogo" label="Volver al catálogo" />

      <div className="h-40 bg-gray-100 rounded mb-4" />
      <h1 className="text-2xl font-semibold text-ink">{producto.nombre}</h1>
      <p className="text-xs text-gray-400 mb-3">{producto.sku}</p>
      <p className="text-sm text-gray-600 mb-4">{producto.descripcion}</p>

      <div className="flex items-center justify-between mb-4">
        <PriceTag original={producto.precio.original} final={producto.precio.final} promocion={producto.precio.promocion} />
        <Pill tone={producto.disponible ? 'ok' : 'falla'}>
          {producto.disponible ? 'Disponible' : producto.disponibilidadMotivo ?? 'Sin existencia'}
        </Pill>
      </div>

      <Button onClick={handleAgregar}>Agregar al carrito</Button>

      {agregado && <p className="text-sm text-ok mt-3">Producto agregado al carrito.</p>}
      {error && (
        <UnavailableNotice motivo={error} sugerencia="Tienda Zona 10 tiene existencia de un producto similar" />
      )}
    </div>
  )
}
