import { beforeEach, describe, expect, it } from 'vitest'
import { listarIdsOrdenes, registrarOrden } from './orderIndex'

describe('orderIndex', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('listarIdsOrdenes retorna [] si el cliente no tiene órdenes registradas', () => {
    expect(listarIdsOrdenes('cliente-x')).toEqual([])
  })

  it('registrarOrden agrega el id a la lista del cliente', () => {
    registrarOrden('cliente-x', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-x')).toEqual(['SGO-000001'])
  })

  it('registrarOrden no duplica un id ya registrado', () => {
    registrarOrden('cliente-x', 'SGO-000001')
    registrarOrden('cliente-x', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-x')).toEqual(['SGO-000001'])
  })

  it('el índice queda aislado por cliente', () => {
    registrarOrden('cliente-a', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-b')).toEqual([])
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna []', () => {
    localStorage.setItem('sgo-order-ids-cliente-x', '{esto no es json')
    expect(listarIdsOrdenes('cliente-x')).toEqual([])
  })
})
