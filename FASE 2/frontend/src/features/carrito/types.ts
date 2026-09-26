export interface CartItem {
  productId: string
  nombre: string
  sku: string
  cantidad: number
  precioUnitario: number
}

export interface Cart {
  items: CartItem[]
}

export const EMPTY_CART: Cart = { items: [] }
