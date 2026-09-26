import type { CartRepository } from './cartRepository'
import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import type { Cart, CartItem } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'

interface BackendCartItem {
  productId: number
  quantity: number
}

interface BackendCart {
  cartId: number | null
  status: string | null
  channel: string | null
  items: BackendCartItem[]
}

async function mapearItem(item: BackendCartItem): Promise<CartItem | null> {
  try {
    const producto = await httpCatalogRepository.getById(String(item.productId))
    if (!producto) return null
    return {
      productId: producto.id,
      nombre: producto.nombre,
      sku: producto.sku,
      cantidad: item.quantity,
      precioUnitario: producto.precio.final,
    }
  } catch {
    // Un producto que falla al consultarse no debe tumbar el carrito completo — se omite, igual
    // que ya hace catalogRepository.http.ts con la disponibilidad.
    return null
  }
}

async function mapearCarrito(backendCart: BackendCart): Promise<Cart> {
  const items = await Promise.all(backendCart.items.map(mapearItem))
  return { items: items.filter((item): item is CartItem => item !== null) }
}

export const httpCartRepository: CartRepository = {
  async getCart(customerId) {
    const backendCart = await manejarRespuesta<BackendCart>(await fetch(`/api/customers/${customerId}/cart`))
    return mapearCarrito(backendCart)
  },

  async addItem(customerId, productId, cantidad) {
    let backendCart: BackendCart
    try {
      backendCart = await manejarRespuesta<BackendCart>(
        await fetch(`/api/customers/${customerId}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: Number(productId), quantity: cantidad, channel: 'WEB' }),
        }),
      )
    } catch (e) {
      if (e instanceof NotFoundError) throw new Error('El producto ya no está disponible o no existe')
      throw e
    }
    return mapearCarrito(backendCart)
  },
}
