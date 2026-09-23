import { BackLink } from '../../../shared/components/BackLink'

export function CheckoutPlaceholderPage() {
  return (
    <div>
      <BackLink to="/carrito" label="Volver al carrito" />
      <h1 className="text-2xl font-semibold text-ink mb-2">Checkout</h1>
      <p className="text-sm text-gray-500">
        Selección de entrega y confirmación de compra — próxima entrega (PB-004).
      </p>
    </div>
  )
}
