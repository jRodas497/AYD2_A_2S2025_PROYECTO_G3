import { coincide } from './catalogSearch'
import type { CatalogRepository } from './catalogRepository'
import type { Product } from '../types'

export const PRODUCTO_AGOTADO_SKU = 'EL-0999'

const LATENCIA_MS = 200

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const PRODUCTOS: Product[] = [
  {
    id: '1',
    sku: 'LB-1440',
    nombre: 'Refrigeradora 14 pies³',
    categoria: 'linea_blanca',
    descripcion: 'Refrigeradora de 14 pies cúbicos, eficiencia energética A+.',
    precio: { original: 4999, final: 4999 },
    disponible: true,
  },
  {
    id: '2',
    sku: 'RP-0221',
    nombre: 'Camisa manga larga',
    categoria: 'ropa',
    descripcion: 'Camisa de vestir manga larga, corte regular.',
    precio: { original: 299, final: 258, promocion: '14% off temporada' },
    disponible: true,
  },
  {
    id: '3',
    sku: 'EL-0907',
    nombre: 'Audífonos inalámbricos',
    categoria: 'electronica',
    descripcion: 'Audífonos bluetooth con cancelación de ruido.',
    precio: { original: 349, final: 349 },
    disponible: true,
  },
  {
    id: '4',
    sku: PRODUCTO_AGOTADO_SKU,
    nombre: 'Smart TV 55"',
    categoria: 'electronica',
    descripcion: 'Smart TV 55 pulgadas 4K.',
    precio: { original: 3299, final: 2999, promocion: 'Black Friday anticipado' },
    disponible: false,
    disponibilidadMotivo: 'Sin existencia en el centro de distribución más cercano',
  },
  {
    id: '5',
    sku: 'CZ-0110',
    nombre: 'Tenis deportivos',
    categoria: 'calzado',
    descripcion: 'Tenis para running, talla única mostrada en detalle.',
    precio: { original: 449, final: 449 },
    disponible: true,
  },
  {
    id: '6',
    sku: 'LB-2200',
    nombre: 'Lavadora 18kg',
    categoria: 'linea_blanca',
    descripcion: 'Lavadora automática de carga superior, 18kg.',
    precio: { original: 3599, final: 3239, promocion: '10% off línea blanca' },
    disponible: true,
  },
]

export { coincide } from './catalogSearch'

export const mockCatalogRepository: CatalogRepository = {
  async list() {
    return esperar(PRODUCTOS)
  },
  async search(query, categoria) {
    return esperar(PRODUCTOS.filter((p) => coincide(p, query, categoria)))
  },
  async getById(id) {
    return esperar(PRODUCTOS.find((p) => p.id === id) ?? null)
  },
}
