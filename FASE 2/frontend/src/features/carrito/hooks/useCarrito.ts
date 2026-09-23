import { mockCatalogRepository } from '../../catalogo/api/catalogRepository.mock'
import type { Product } from '../../catalogo/types'
import { useCartContext } from '../context/CartContext'

export type ResultadoAgregar = { ok: true } | { ok: false; motivo: string }

export function useCarrito() {
  const { cart, cargando, setCart } = useCartContext()

  async function agregarProducto(producto: Product, cantidad = 1): Promise<ResultadoAgregar> {
    const actual = await mockCatalogRepository.getById(producto.id)
    if (!actual || !actual.disponible) {
      return { ok: false, motivo: actual?.disponibilidadMotivo ?? 'Producto sin existencia disponible' }
    }

    const items = [...cart.items]
    const existente = items.find((i) => i.productId === producto.id)
    if (existente) {
      existente.cantidad += cantidad
    } else {
      items.push({
        productId: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        cantidad,
        precioUnitario: producto.precio.final,
      })
    }

    await setCart({ items })
    return { ok: true }
  }

  const total = cart.items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)

  return { cart, cargando, agregarProducto, total }
}
