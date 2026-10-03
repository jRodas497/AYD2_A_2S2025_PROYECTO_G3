import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { PriceTag } from '../../../shared/components/PriceTag'
import { Button } from '../../../shared/components/Button'
import { BackLink } from '../../../shared/components/BackLink'
import { QuantityStepper } from '../../../shared/components/QuantityStepper'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { useProducto } from '../hooks/useCatalogo'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { UnavailableNotice } from '../../carrito/components/UnavailableNotice'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { producto, cargando, error: errorCarga } = useProducto(id)
  const { agregarProducto } = useCarrito()
  const { notificar } = useNotify()
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)

  if (cargando) return <p className="text-sm text-gray-400">Cargando producto…</p>
  if (errorCarga) return <p className="text-sm text-falla">{errorCarga}</p>
  if (!producto) return <p className="text-sm text-falla">Producto no encontrado.</p>

  async function handleAgregar() {
    if (!producto || agregando) return
    setError(null)
    setAgregando(true)
    try {
      const resultado = await agregarProducto(producto, cantidad)
      if (resultado.ok) {
        notificar(`${producto.nombre} (${cantidad}) se agregó al carrito`, 'ok')
        setCantidad(1)
      } else {
        setError(resultado.motivo)
      }
    } finally {
      setAgregando(false)
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

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Cantidad</span>
        <QuantityStepper
          cantidad={cantidad}
          min={1}
          etiqueta={producto.nombre}
          onDecrementar={() => setCantidad((c) => Math.max(1, c - 1))}
          onIncrementar={() => setCantidad((c) => c + 1)}
        />
      </div>

      <Button onClick={handleAgregar} disabled={agregando}>
        {agregando ? 'Agregando…' : 'Agregar al carrito'}
      </Button>

      {error && (
        <UnavailableNotice motivo={error} sugerencia="Tienda Zona 10 tiene existencia de un producto similar" />
      )}
    </div>
  )
}
