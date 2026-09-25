import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCartRepository } from '../api/cartRepository.http'
import { EMPTY_CART, type Cart } from '../types'
import { useCustomer } from '../../../shared/context/CustomerContext'

interface CartContextValue {
  cart: Cart
  cargando: boolean
  error: string | null
  agregarItem: (productId: string, cantidad: number) => Promise<void>
  resetearLocal: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    httpCartRepository
      .getCart(customer.id)
      .then((resultado) => {
        if (cancelado) return
        setCart(resultado)
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el carrito')
        setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [customer.id])

  async function agregarItem(productId: string, cantidad: number) {
    const nuevoCart = await httpCartRepository.addItem(customer.id, productId, cantidad)
    setCart(nuevoCart)
    setError(null)
  }

  function resetearLocal() {
    setCart(EMPTY_CART)
  }

  return (
    <CartContext.Provider value={{ cart, cargando, error, agregarItem, resetearLocal }}>{children}</CartContext.Provider>
  )
}

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCartContext debe usarse dentro de <CartProvider>')
  return value
}
