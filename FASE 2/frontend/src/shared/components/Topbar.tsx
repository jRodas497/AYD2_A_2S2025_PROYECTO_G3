import { Link, useLocation } from 'react-router-dom'
import { useCustomer } from '../context/CustomerContext'
import { useAuth } from '../context/AuthContext'
import { useCartContext } from '../../features/carrito/context/CartContext'
export function Topbar() {
  const { customer } = useCustomer()
  const { session, verified } = useAuth()
  const { cart } = useCartContext()
  const staffArea = useLocation().pathname.startsWith('/administracion')
  const total = cart.items.reduce((sum, item) => sum + item.cantidad, 0)
  return <header className="min-h-14 flex flex-wrap items-center justify-end gap-2 sm:gap-5 pl-16 pr-3 sm:px-8 py-2 border-b border-linea bg-white text-xs sm:text-sm">
    {staffArea ? <>
      <Link to="/catalogo" className="text-brand">Ir a la tienda</Link>
      {verified && session && <span>Personal: {session.username}</span>}
    </> : <>
      {customer && <Link to="/carrito" className="text-brand">Carrito {total > 0 && <span>({total})</span>}</Link>}
      <Link to="/administracion/login" className="text-gray-500 hover:text-brand">{verified && session ? `Personal: ${session.username}` : 'Iniciar sesión de personal'}</Link>
      {customer ? <Link to="/perfil" className="text-brand">{customer.nombre}</Link> : <Link to="/ingresar" className="text-brand">Iniciar sesión</Link>}
    </>}
  </header>
}
