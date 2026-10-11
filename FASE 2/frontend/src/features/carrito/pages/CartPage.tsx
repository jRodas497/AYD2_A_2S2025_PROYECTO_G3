import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarrito } from '../hooks/useCarrito'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import type { CartItem } from '../types'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CartPage() {
  const { cart, cargando, error, total, incrementarItem, decrementarItem, eliminarItem } = useCarrito()
  const { notificar } = useNotify()
  // + y − cuentan cada clic: el servidor suma o resta en una sola sentencia, así que no hace falta
  // bloquear esos botones. Quitar sí se bloquea mientras está en curso, para no disparar un segundo
  // borrado de un producto que ya no está en el carrito.
  const [channel, setChannel] = useState(localStorage.getItem('sgo-channel') ?? 'WEB')
  const [pendientes, setPendientes] = useState<Set<string>>(new Set())

  function marcarPendiente(productId: string, valor: boolean) {
    setPendientes((actual) => {
      const copia = new Set(actual)
      if (valor) copia.add(productId)
      else copia.delete(productId)
      return copia
    })
  }

  async function handleIncrementar(item: CartItem) {
    const resultado = await incrementarItem(item.productId)
    if (resultado.ok) {
      notificar(`Cantidad de ${item.nombre} actualizada a ${item.cantidad + 1}`, 'ok')
    } else {
      notificar(resultado.motivo, 'falla')
    }
  }

  async function handleDecrementar(item: CartItem) {
    const resultado = await decrementarItem(item.productId)
    if (!resultado.ok) notificar(resultado.motivo, 'falla')
  }

  async function handleEliminar(item: CartItem) {
    if (pendientes.has(item.productId)) return
    marcarPendiente(item.productId, true)
    try {
      const resultado = await eliminarItem(item.productId)
      if (resultado.ok) {
        notificar(`${item.nombre} se quitó del carrito`, 'ok')
      } else {
        notificar(resultado.motivo, 'falla')
      }
    } finally {
      marcarPendiente(item.productId, false)
    }
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando carrito…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Carrito</h1>

      <label className="block text-sm mb-4">Canal de compra<select className="border rounded p-2 ml-3" value={channel} onChange={e => { setChannel(e.target.value); localStorage.setItem('sgo-channel', e.target.value) }}><option value="WEB">Web</option><option value="MOBILE">Aplicación móvil</option><option value="CALL_CENTER">Centro de atención</option></select></label>
      {cart.items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Tu carrito está vacío. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      ) : (
        <>
          <div className="bg-white border border-linea rounded p-4">
            <div className="divide-y divide-linea">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-3">
                  <div className="w-14 h-14 bg-gray-100 rounded flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm">{item.nombre}</div>
                    <div className="text-xs text-gray-400">{item.sku}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDecrementar(item)}
                      className="w-8 h-8 flex items-center justify-center border border-linea rounded text-ink hover:bg-crema"
                      aria-label={`Quitar una unidad de ${item.nombre}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm text-gray-700">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => handleIncrementar(item)}
                      className="w-8 h-8 flex items-center justify-center border border-linea rounded text-ink hover:bg-crema"
                      aria-label={`Agregar una unidad más de ${item.nombre}`}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
                  <button
                    type="button"
                    onClick={() => handleEliminar(item)}
                    disabled={pendientes.has(item.productId)}
                    className="text-xs text-falla hover:underline disabled:opacity-50"
                    aria-label={`Quitar ${item.nombre} del carrito`}
                  >
                    Quitar
                  </button>
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
