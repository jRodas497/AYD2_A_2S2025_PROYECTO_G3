import { beforeEach, describe, expect, it } from 'vitest'
import { mockCartRepository } from './cartRepository.mock'
import { EMPTY_CART } from '../types'

describe('mockCartRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna un carrito vacío si el cliente no tiene carrito guardado', async () => {
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })

  it('addItem agrega un producto nuevo con sus datos del catálogo mock', async () => {
    const cart = await mockCartRepository.addItem('cliente-x', '1', 2)
    expect(cart.items).toEqual([
      { productId: '1', nombre: 'Refrigeradora 14 pies³', sku: 'LB-1440', cantidad: 2, precioUnitario: 4999 },
    ])
  })

  it('addItem incrementa la cantidad si el producto ya estaba en el carrito', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 1)
    const cart = await mockCartRepository.addItem('cliente-x', '1', 2)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].cantidad).toBe(3)
  })

  it('el carrito persiste tras un round-trip de localStorage', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 1)
    const recuperado = await mockCartRepository.getCart('cliente-x')
    expect(recuperado.items).toHaveLength(1)
  })

  it('el carrito queda aislado por cliente', async () => {
    await mockCartRepository.addItem('cliente-a', '1', 1)
    const carritoB = await mockCartRepository.getCart('cliente-b')
    expect(carritoB).toEqual(EMPTY_CART)
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna carrito vacío', async () => {
    localStorage.setItem('sgo-cart-cliente-x', '{esto no es json')
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })

  it('setQuantity fija la cantidad exacta del item', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 3)
    const cart = await mockCartRepository.setQuantity('cliente-x', '1', 1)
    expect(cart.items[0].cantidad).toBe(1)
  })

  it('removeItem quita el item y deja el resto del carrito intacto', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 1)
    await mockCartRepository.addItem('cliente-x', '2', 1)
    const cart = await mockCartRepository.removeItem('cliente-x', '1')
    expect(cart.items.map((i) => i.productId)).toEqual(['2'])
  })
})
