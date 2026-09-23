import type { Categoria, Product } from '../types'

export interface CatalogRepository {
  list(): Promise<Product[]>
  search(query: string, categoria?: Categoria): Promise<Product[]>
  getById(id: string): Promise<Product | null>
}
