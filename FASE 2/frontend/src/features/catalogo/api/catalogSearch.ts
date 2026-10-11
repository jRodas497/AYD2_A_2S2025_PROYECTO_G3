import type { Product, Categoria } from '../types'

export function coincide(producto: Product, query: string, categoria?: Categoria): boolean {
  const coincideCategoria = !categoria || producto.categoria === categoria
  const coincideTexto = !query || producto.nombre.toLowerCase().includes(query.toLowerCase())
  return coincideCategoria && coincideTexto
}
