import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import type { Product } from '../../catalogo/types'
import { useCartContext } from '../context/CartContext'

export type ResultadoAgregar = { ok: true } | { ok: false; motivo: string }

export function useCarrito() {
  const { cart, cargando, error, agregarItem, cambiarCantidad, quitarItem, resetearLocal } = useCartContext()

  async function agregarProducto(producto: Product, cantidad = 1): Promise<ResultadoAgregar> {
    let actual: Product | null
    try {
      actual = await httpCatalogRepository.getById(producto.id)
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo verificar el producto' }
    }
    if (!actual || !actual.disponible) {
      return { ok: false, motivo: actual?.disponibilidadMotivo ?? 'Producto sin existencia disponible' }
    }

    try {
      await agregarItem(producto.id, cantidad)
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo agregar el producto al carrito' }
    }
    return { ok: true }
  }

  async function incrementarItem(productId: string): Promise<ResultadoAgregar> {
    try {
      await agregarItem(productId, 1)
      return { ok: true }
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo actualizar la cantidad' }
    }
  }

  /** Baja una unidad; si ya tenía 1, quita el ítem en vez de dejarlo en 0. */
  async function decrementarItem(productId: string, cantidadActual: number): Promise<ResultadoAgregar> {
    try {
      if (cantidadActual <= 1) {
        await quitarItem(productId)
      } else {
        await cambiarCantidad(productId, cantidadActual - 1)
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo actualizar la cantidad' }
    }
  }

  async function eliminarItem(productId: string): Promise<ResultadoAgregar> {
    try {
      await quitarItem(productId)
      return { ok: true }
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo quitar el producto' }
    }
  }

  const total = cart.items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)

  return {
    cart,
    cargando,
    error,
    agregarProducto,
    incrementarItem,
    decrementarItem,
    eliminarItem,
    resetearCarritoLocal: resetearLocal,
    total,
  }
}
