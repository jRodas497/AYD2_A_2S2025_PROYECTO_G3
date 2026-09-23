import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { mockCartRepository } from '../api/cartRepository.mock'
import { EMPTY_CART, type Cart } from '../types'
import { useCustomer } from '../../../shared/context/CustomerContext'

interface CartContextValue {
  cart: Cart
  cargando: boolean
  setCart: (cart: Cart) => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer()
  const [cart, setCartState] = useState<Cart>(EMPTY_CART)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    mockCartRepository.getCart(customer.id).then((resultado) => {
      setCartState(resultado)
      setCargando(false)
    })
  }, [customer.id])

  async function setCart(nuevoCart: Cart) {
    setCartState(nuevoCart)
    await mockCartRepository.saveCart(customer.id, nuevoCart)
  }

  return <CartContext.Provider value={{ cart, cargando, setCart }}>{children}</CartContext.Provider>
}

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCartContext debe usarse dentro de <CartProvider>')
  return value
}
