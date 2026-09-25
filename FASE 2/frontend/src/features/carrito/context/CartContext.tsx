import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCartRepository } from '../api/cartRepository.http'
import { EMPTY_CART, type Cart } from '../types'
import { useCustomer } from '../../../shared/context/CustomerContext'

interface CartContextValue {
  cart: Cart
  cargando: boolean
  agregarItem: (productId: string, cantidad: number) => Promise<void>
  resetearLocal: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    httpCartRepository.getCart(customer.id).then((resultado) => {
      setCart(resultado)
      setCargando(false)
    })
  }, [customer.id])

  async function agregarItem(productId: string, cantidad: number) {
    const nuevoCart = await httpCartRepository.addItem(customer.id, productId, cantidad)
    setCart(nuevoCart)
  }

  function resetearLocal() {
    setCart(EMPTY_CART)
  }

  return <CartContext.Provider value={{ cart, cargando, agregarItem, resetearLocal }}>{children}</CartContext.Provider>
}

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCartContext debe usarse dentro de <CartProvider>')
  return value
}
