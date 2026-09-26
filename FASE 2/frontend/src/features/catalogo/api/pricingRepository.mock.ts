import type { PricingRepository, Promotion } from './pricingRepository'

const LATENCIA_MS = 150

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const PROMOCIONES: Promotion[] = [
  {
    id: 'promo-1',
    nombre: '14% off temporada',
    descripcion: 'Ropa seleccionada de temporada.',
    descuentoPorcentaje: 14,
    categoriasAplicables: ['ropa'],
  },
  {
    id: 'promo-2',
    nombre: '10% off línea blanca',
    descripcion: 'Electrodomésticos de línea blanca seleccionados.',
    descuentoPorcentaje: 10,
    categoriasAplicables: ['linea_blanca'],
  },
  {
    id: 'promo-3',
    nombre: 'Black Friday anticipado',
    descripcion: 'Adelanto de Black Friday en electrónica seleccionada.',
    descuentoPorcentaje: 9,
    categoriasAplicables: ['electronica'],
  },
]

export const mockPricingRepository: PricingRepository = {
  async listActivePromotions() {
    return esperar(PROMOCIONES)
  },
}
