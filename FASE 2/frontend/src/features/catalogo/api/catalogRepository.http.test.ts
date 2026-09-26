import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpCatalogRepository } from './catalogRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpCatalogRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('list() mapea productos del backend y consulta disponibilidad por cada uno', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, sku: 'LB-003', name: 'Estufa de 4 quemadores', category: 'LINEA_BLANCA', price: 2100, active: true },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ productId: 1, totalAvailable: 5, byLocation: [] }))

    const productos = await httpCatalogRepository.list()

    expect(fetchMock).toHaveBeenCalledWith('/api/products')
    expect(fetchMock).toHaveBeenCalledWith('/api/inventory/products/1/availability')
    expect(productos).toEqual([
      {
        id: '1',
        sku: 'LB-003',
        nombre: 'Estufa de 4 quemadores',
        categoria: 'linea_blanca',
        descripcion: '',
        precio: { original: 2100, final: 2100 },
        disponible: true,
      },
    ])
  })

  it('marca disponible=false con motivo cuando totalAvailable es 0', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse([{ id: 2, sku: 'EL-010', name: 'Parlante', category: 'ELECTRONICA', price: 350, active: true }]),
      )
      .mockResolvedValueOnce(jsonResponse({ productId: 2, totalAvailable: 0, byLocation: [] }))

    const [producto] = await httpCatalogRepository.list()
    expect(producto.disponible).toBe(false)
    expect(producto.disponibilidadMotivo).toBe('Sin existencia disponible')
  })

  it('si la consulta de disponibilidad de un producto falla, el resto de la lista igual se devuelve', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 3, sku: 'RP-001', name: 'Camisa', category: 'ROPA', price: 200, active: true },
          { id: 4, sku: 'CZ-001', name: 'Tenis', category: 'CALZADO', price: 400, active: true },
        ]),
      )
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(jsonResponse({ productId: 4, totalAvailable: 10, byLocation: [] }))

    const productos = await httpCatalogRepository.list()

    expect(productos).toHaveLength(2)
    expect(productos[0].disponible).toBe(false)
    expect(productos[0].disponibilidadMotivo).toBe('No se pudo verificar la existencia')
    expect(productos[1].disponible).toBe(true)
  })

  it('getById() devuelve null en 404 en vez de lanzar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const producto = await httpCatalogRepository.getById('999')
    expect(producto).toBeNull()
  })

  it('search() filtra en el cliente por texto y categoría', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 5, sku: 'LB-005', name: 'Refrigeradora', category: 'LINEA_BLANCA', price: 5000, active: true },
          { id: 6, sku: 'EL-005', name: 'Televisor', category: 'ELECTRONICA', price: 3000, active: true },
        ]),
      )
      .mockResolvedValue(jsonResponse({ productId: 0, totalAvailable: 1, byLocation: [] }))

    const resultado = await httpCatalogRepository.search('tele', undefined)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombre).toBe('Televisor')
  })
})
