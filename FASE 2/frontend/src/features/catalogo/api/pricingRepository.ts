export interface Promotion {
  id: string
  nombre: string
  descripcion: string
  descuentoPorcentaje: number
  categoriasAplicables: string[]
}

export interface PricingRepository {
  listActivePromotions(): Promise<Promotion[]>
}
