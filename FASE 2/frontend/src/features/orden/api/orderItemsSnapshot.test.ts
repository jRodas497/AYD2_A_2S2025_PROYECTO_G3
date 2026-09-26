import { beforeEach, describe, expect, it } from 'vitest'
import { guardarSnapshot, obtenerSnapshot } from './orderItemsSnapshot'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

describe('orderItemsSnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('obtenerSnapshot retorna null si no hay snapshot guardado', () => {
    expect(obtenerSnapshot('SGO-000001')).toBeNull()
  })

  it('guardarSnapshot + obtenerSnapshot hacen un round-trip correcto', () => {
    guardarSnapshot('SGO-000001', { items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(obtenerSnapshot('SGO-000001')).toEqual({ items: [ITEM], direccionEntrega: 'Zona 10' })
  })

  it('el snapshot queda aislado por orden', () => {
    guardarSnapshot('SGO-000001', { items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(obtenerSnapshot('SGO-000002')).toBeNull()
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna null', () => {
    localStorage.setItem('sgo-order-items-SGO-000001', '{esto no es json')
    expect(obtenerSnapshot('SGO-000001')).toBeNull()
  })
})
