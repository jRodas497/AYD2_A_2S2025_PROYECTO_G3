import { apiFetch as fetch } from '../../../shared/api/apiFetch'
import type { CatalogRepository } from './catalogRepository'
import { coincide } from './catalogSearch'
import type { Categoria, Product } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'

interface BackendProduct {
  id: number
  sku: string
  name: string
  category: string
  originalPrice?: number
  price: number
  active: boolean
}

interface BackendAvailability {
  productId: number
  totalAvailable: number
  byLocation: { locationCode: string; locationName: string; available: number }[]
}

function mapearCategoria(categoria: string): Categoria {
  return categoria.toLowerCase() as Categoria
}

async function obtenerDisponibilidad(id: number): Promise<Pick<Product, 'disponible' | 'disponibilidadMotivo'>> {
  try {
    const data = await manejarRespuesta<BackendAvailability>(await fetch(`/api/inventory/products/${id}/availability`))
    if (data.totalAvailable > 0) return { disponible: true }
    return { disponible: false, disponibilidadMotivo: 'Sin existencia disponible' }
  } catch {
    // Si la consulta de disponibilidad de un producto falla, no se cae el catálogo completo:
    // ese producto se marca como no disponible y el resto de la lista sigue su curso.
    return { disponible: false, disponibilidadMotivo: 'No se pudo verificar la existencia' }
  }
}

async function mapearProducto(backendProducto: BackendProduct): Promise<Product> {
  const disponibilidad = await obtenerDisponibilidad(backendProducto.id)
  return {
    id: String(backendProducto.id),
    sku: backendProducto.sku,
    nombre: backendProducto.name,
    categoria: mapearCategoria(backendProducto.category),
    // El backend no tiene un campo de descripción todavía (ver docs/contratos-api/catalog-service.md).
    descripcion: '',
    precio: { original: backendProducto.originalPrice ?? backendProducto.price, final: backendProducto.price },
    ...disponibilidad,
  }
}

export const httpCatalogRepository: CatalogRepository = {
  async list() {
    const backendProductos = await manejarRespuesta<BackendProduct[]>(await fetch('/api/products'))
    return Promise.all(backendProductos.map(mapearProducto))
  },

  async search(query, categoria) {
    const productos = await httpCatalogRepository.list()
    return productos.filter((p) => coincide(p, query, categoria))
  },

  async getById(id) {
    try {
      const backendProducto = await manejarRespuesta<BackendProduct>(await fetch(`/api/products/${id}`))
      if (!backendProducto.active) return null
      return await mapearProducto(backendProducto)
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },
}
