import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CheckoutPage() {
  const { cart, cargando, total, resetearCarritoLocal } = useCarrito()
  const { customer } = useCustomer()
  const navigate = useNavigate()
  const [direccionEntrega, setDireccionEntrega] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!direccionEntrega.trim()) return
    setConfirmando(true)
    setError(null)
    try {
      const orden = await httpOrderRepository.createOrder({
        customerId: customer.id,
        items: cart.items,
        direccionEntrega: direccionEntrega.trim(),
      })
      resetearCarritoLocal()
      navigate(`/ordenes/${orden.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra')
      setConfirmando(false)
    }
  }

  return (
    <div>
      <BackLink to="/carrito" label="Volver al carrito" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Checkout</h1>

      <h2 className="text-sm font-medium text-ink mb-2">Dirección de entrega</h2>
      <input
        value={direccionEntrega}
        onChange={(e) => setDireccionEntrega(e.target.value)}
        placeholder="Zona 10, Ciudad de Guatemala"
        required
        className="w-full border border-linea rounded px-3 py-2 text-sm bg-white mb-6"
      />

      {error && <p className="text-sm text-falla mb-4">{error}</p>}

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatQ(total)}</span>
        </div>
      </div>

      <Button onClick={handleConfirmar} disabled={confirmando || !direccionEntrega.trim()}>
        {confirmando ? 'Confirmando…' : 'Confirmar compra'}
      </Button>
    </div>
  )
}
