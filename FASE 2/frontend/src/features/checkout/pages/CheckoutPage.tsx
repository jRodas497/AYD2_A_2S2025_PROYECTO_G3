import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { mockOrderRepository } from '../../orden/api/orderRepository.mock'
import type { MetodoEntrega } from '../../orden/types'

const OPCIONES_ENTREGA: { valor: MetodoEntrega; etiqueta: string; descripcion: string }[] = [
  { valor: 'centro_distribucion', etiqueta: 'Centro de distribución', descripcion: 'Recibe en el CD más cercano.' },
  { valor: 'tienda', etiqueta: 'Tienda', descripcion: 'Recoge en la tienda de tu preferencia.' },
  { valor: 'recogida', etiqueta: 'Recogida', descripcion: 'Recogida en punto acordado.' },
]

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CheckoutPage() {
  const { cart, cargando, total, vaciarCarrito } = useCarrito()
  const { customer } = useCustomer()
  const navigate = useNavigate()
  const [metodoEntrega, setMetodoEntrega] = useState<MetodoEntrega>('centro_distribucion')
  const [confirmando, setConfirmando] = useState(false)

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>

  if (cart.items.length === 0) {
    return (
      <div>
        <BackLink to="/carrito" label="Volver al carrito" />
        <p className="text-sm text-gray-400">
          Tu carrito está vacío. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      </div>
    )
  }

  async function handleConfirmar() {
    setConfirmando(true)
    const orden = await mockOrderRepository.createOrder({
      customerId: customer.id,
      items: cart.items,
      metodoEntrega,
    })
    await vaciarCarrito()
    navigate(`/ordenes/${orden.id}`)
  }

  return (
    <div>
      <BackLink to="/carrito" label="Volver al carrito" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Checkout</h1>

      <h2 className="text-sm font-medium text-ink mb-2">Método de entrega</h2>
      <div className="space-y-2 mb-6">
        {OPCIONES_ENTREGA.map((opcion) => (
          <label
            key={opcion.valor}
            className={`flex items-start gap-3 border rounded p-3 cursor-pointer bg-white ${
              metodoEntrega === opcion.valor ? 'border-brand border-2' : 'border-linea'
            }`}
          >
            <input
              type="radio"
              name="metodoEntrega"
              value={opcion.valor}
              checked={metodoEntrega === opcion.valor}
              onChange={() => setMetodoEntrega(opcion.valor)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{opcion.etiqueta}</span>
              <span className="block text-xs text-gray-500">{opcion.descripcion}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatQ(total)}</span>
        </div>
      </div>

      <Button onClick={handleConfirmar} disabled={confirmando}>
        {confirmando ? 'Confirmando…' : 'Confirmar compra'}
      </Button>
    </div>
  )
}
