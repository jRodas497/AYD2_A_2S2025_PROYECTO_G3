import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCartRepository } from '../api/cartRepository.http'
import { EMPTY_CART, type Cart } from '../types'
import { useCustomer } from '../../../shared/context/CustomerContext'

interface CartContextValue {
  cart: Cart
  cargando: boolean
  error: string | null
  agregarItem: (productId: string, cantidad: number) => Promise<void>
  bajarUnidad: (productId: string) => Promise<void>
  quitarItem: (productId: string) => Promise<void>
  resetearLocal: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!customer) {
      setCart(EMPTY_CART)
      setCargando(false)
      setError(null)
      return
    }
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
  }, [customer])

  async function agregarItem(productId: string, cantidad: number) {
    if (!customer) throw new Error('Inicia sesión para agregar productos al carrito')
    const nuevoCart = await httpCartRepository.addItem(customer.id, productId, cantidad)
    setCart(nuevoCart)
    setError(null)
  }

  async function bajarUnidad(productId: string) {
    if (!customer) throw new Error('Inicia sesión para modificar el carrito')
    const nuevoCart = await httpCartRepository.decrementItem(customer.id, productId)
    setCart(nuevoCart)
    setError(null)
  }

  async function quitarItem(productId: string) {
    if (!customer) throw new Error('Inicia sesión para modificar el carrito')
    const nuevoCart = await httpCartRepository.removeItem(customer.id, productId)
    setCart(nuevoCart)
    setError(null)
  }

  function resetearLocal() {
    setCart(EMPTY_CART)
  }

  return (
    <CartContext.Provider value={{ cart, cargando, error, agregarItem, bajarUnidad, quitarItem, resetearLocal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCartContext debe usarse dentro de <CartProvider>')
  return value
}
