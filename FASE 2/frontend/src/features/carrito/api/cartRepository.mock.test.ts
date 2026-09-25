import { beforeEach, describe, expect, it } from 'vitest'
import { mockCartRepository } from './cartRepository.mock'
import { EMPTY_CART, type Cart } from '../types'

describe('mockCartRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna un carrito vacío si el cliente no tiene carrito guardado', async () => {
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })

  it('el round-trip de localStorage no corrompe el carrito', async () => {
    const cart: Cart = {
      items: [{ productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 2, precioUnitario: 4999 }],
    }
    await mockCartRepository.saveCart('cliente-x', cart)
    const recuperado = await mockCartRepository.getCart('cliente-x')
    expect(recuperado).toEqual(cart)
  })

  it('el carrito queda aislado por cliente', async () => {
    await mockCartRepository.saveCart('cliente-a', {
      items: [{ productId: '1', nombre: 'A', sku: 'A', cantidad: 1, precioUnitario: 10 }],
    })
    const carritoB = await mockCartRepository.getCart('cliente-b')
    expect(carritoB).toEqual(EMPTY_CART)
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna carrito vacío', async () => {
    localStorage.setItem('sgo-cart-cliente-x', '{esto no es json')
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })
})
