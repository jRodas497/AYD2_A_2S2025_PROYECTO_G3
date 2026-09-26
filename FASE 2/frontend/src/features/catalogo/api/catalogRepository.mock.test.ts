import { describe, expect, it } from 'vitest'
import { mockCatalogRepository, PRODUCTO_AGOTADO_SKU } from './catalogRepository.mock'

describe('mockCatalogRepository', () => {
  it('lista todos los productos semilla', async () => {
    const productos = await mockCatalogRepository.list()
    expect(productos.length).toBeGreaterThan(0)
  })

  it('filtra por nombre (case-insensitive)', async () => {
    const resultado = await mockCatalogRepository.search('refrigeradora')
    expect(resultado.length).toBeGreaterThan(0)
    expect(resultado.every((p) => p.nombre.toLowerCase().includes('refrigeradora'))).toBe(true)
  })

  it('filtra por categoría', async () => {
    const resultado = await mockCatalogRepository.search('', 'ropa')
    expect(resultado.length).toBeGreaterThan(0)
    expect(resultado.every((p) => p.categoria === 'ropa')).toBe(true)
  })

  it('el SKU mágico de "sin disponibilidad" siempre viene marcado como no disponible', async () => {
    const productos = await mockCatalogRepository.list()
    const agotado = productos.find((p) => p.sku === PRODUCTO_AGOTADO_SKU)
    expect(agotado).toBeDefined()
    expect(agotado?.disponible).toBe(false)
    expect(agotado?.disponibilidadMotivo).toBeTruthy()
  })

  it('getById retorna null si el id no existe', async () => {
    const resultado = await mockCatalogRepository.getById('no-existe')
    expect(resultado).toBeNull()
  })

  it('la latencia simulada no bloquea más de 500ms', async () => {
    const inicio = Date.now()
    await mockCatalogRepository.list()
    expect(Date.now() - inicio).toBeLessThan(500)
  })
})
