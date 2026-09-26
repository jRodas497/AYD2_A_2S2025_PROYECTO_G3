export type Categoria = 'linea_blanca' | 'electronica' | 'ropa' | 'calzado'

export interface PriceBreakdown {
  original: number
  final: number
  promocion?: string
}

export interface Product {
  id: string
  sku: string
  nombre: string
  categoria: Categoria
  descripcion: string
  precio: PriceBreakdown
  disponible: boolean
  disponibilidadMotivo?: string
}
