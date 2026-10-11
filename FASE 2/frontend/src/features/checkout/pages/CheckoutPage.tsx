import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'
import { CheckoutPaymentChoice } from '../../credito/CheckoutPaymentChoice'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CheckoutPage() {
  const { cart, cargando, error: errorCarrito, total, resetearCarritoLocal } = useCarrito()
  const { customer } = useCustomer()
  const navigate = useNavigate()
  const [pickup, setPickup] = useState(false)
  const [storeId, setStoreId] = useState('')
  const [stores, setStores] = useState<{id:number;code:string;name:string;type_id:number}[]>([])
  useEffect(() => { apiFetch('/api/inventory/locations').then(r => manejarRespuesta<{id:number;code:string;name:string;type_id:number}[]>(r)).then(rows => setStores(rows.filter(r => r.type_id===2))).catch(() => setStores([])) }, [])
  const [direccionEntrega, setDireccionEntrega] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod,setPaymentMethod]=useState<'CARD'|'CREDIT'>('CARD')

  if (!customer) return <Navigate to="/ingresar" replace />
  const customerId = customer.id
  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (errorCarrito) return <p className="text-sm text-falla">{errorCarrito}</p>

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
    if ((!pickup && !direccionEntrega.trim()) || (pickup && !storeId)) return
    setConfirmando(true)
    setError(null)
    try {
      const orden = await httpOrderRepository.createOrder({
        customerId,
        channel: localStorage.getItem('sgo-channel') ?? 'WEB',
        paymentMethod,
        items: cart.items,
        direccionEntrega: pickup ? 'Retiro en tienda' : direccionEntrega.trim(),
        pickupLocationId: pickup ? Number(storeId) : undefined,
      })
      resetearCarritoLocal()
      navigate(paymentMethod==='CREDIT'?`/ordenes/${orden.id}/pago`:`/ordenes/${orden.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra')
      setConfirmando(false)
    }
  }

  return (
    <div>
      <BackLink to="/carrito" label="Volver al carrito" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Checkout</h1>

      <label className="flex gap-2 text-sm mb-3"><input type="checkbox" checked={pickup} onChange={e => setPickup(e.target.checked)} />Retirar en tienda</label>
      {pickup && <label className="block text-sm mb-4">Tienda de retiro<select className="border rounded p-2 w-full" value={storeId} onChange={e => setStoreId(e.target.value)}><option value="">Selecciona una tienda</option>{stores.map(s => <option value={s.id} key={s.id}>{s.code} · {s.name}</option>)}</select></label>}
      <h2 className="text-sm font-medium text-ink mb-2">Dirección de entrega</h2>
      <input
        value={direccionEntrega}
        onChange={(e) => setDireccionEntrega(e.target.value)}
        placeholder="Zona 10, Ciudad de Guatemala"
        required={!pickup}
        disabled={pickup}
        className="w-full border border-linea rounded px-3 py-2 text-sm bg-white mb-6"
      />

      {error && <p className="text-sm text-falla mb-4">{error}</p>}

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatQ(total)}</span>
        </div>
      </div>

      <CheckoutPaymentChoice customerId={customerId} total={total} value={paymentMethod} onChange={setPaymentMethod}/>
      <Button onClick={handleConfirmar} disabled={confirmando || (pickup ? !storeId : !direccionEntrega.trim())}>
        {confirmando ? 'Confirmando…' : 'Confirmar compra'}
      </Button>
    </div>
  )
}
