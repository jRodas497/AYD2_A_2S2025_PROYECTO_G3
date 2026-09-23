import { Link } from 'react-router-dom'
import { useCustomer } from '../context/CustomerContext'
import { useCartContext } from '../../features/carrito/context/CartContext'

export function Topbar() {
  const customer = useCustomer()
  const { cart } = useCartContext()
  const cantidadTotal = cart.items.reduce((total, item) => total + item.cantidad, 0)

  return (
    <header className="h-14 flex items-center justify-end gap-5 px-8 border-b border-linea bg-white text-sm">
      <Link to="/carrito" className="flex items-center gap-1.5 text-brand hover:underline">
        Carrito
        {cantidadTotal > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] flex items-center justify-center">
            {cantidadTotal}
          </span>
        )}
      </Link>
      <span className="text-gray-500">{customer.nombre}</span>
    </header>
  )
}
