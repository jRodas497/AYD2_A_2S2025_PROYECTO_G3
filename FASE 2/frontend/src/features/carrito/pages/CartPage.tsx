import { Link } from 'react-router-dom'
import { useCarrito } from '../hooks/useCarrito'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import type { CartItem } from '../types'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CartPage() {
  const { cart, cargando, total, incrementarItem } = useCarrito()
  const { notificar } = useNotify()

  async function handleIncrementar(item: CartItem) {
    await incrementarItem(item.productId)
    notificar(`Cantidad de ${item.nombre} actualizada a ${item.cantidad + 1}`, 'ok')
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando carrito…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Carrito</h1>

      {cart.items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Tu carrito está vacío. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            Por ahora solo se pueden agregar más unidades desde aquí. Para quitar productos o reducir
            cantidades, contacta a servicio al cliente.
          </p>
          <div className="bg-white border border-linea rounded p-4">
            <div className="divide-y divide-linea">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-3">
                  <div className="w-14 h-14 bg-gray-100 rounded flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm">{item.nombre}</div>
                    <div className="text-xs text-gray-400">{item.sku}</div>
                  </div>
                  <div className="text-sm text-gray-500 w-24 text-center">Cantidad: {item.cantidad}</div>
                  <button
                    type="button"
                    onClick={() => handleIncrementar(item)}
                    className="w-8 h-8 flex items-center justify-center border border-linea rounded text-ink hover:bg-crema"
                    aria-label={`Agregar una unidad más de ${item.nombre}`}
                  >
                    +
                  </button>
                  <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold border-t border-linea mt-3 pt-3 text-sm">
              <span>Total</span>
              <span>{formatQ(total)}</span>
            </div>
          </div>

          <div className="text-right mt-4">
            <Link to="/checkout">
              <Button>Continuar</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
