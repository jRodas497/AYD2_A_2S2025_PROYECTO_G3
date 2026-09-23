import type { OrderRepository } from './orderRepository'
import type { CrearOrdenInput, Order } from '../types'

const LATENCIA_MS = 200

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

const ORDENES: Order[] = []
let siguienteNumero = 1

function calcularTotal(items: CrearOrdenInput['items']): number {
  return items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)
}

function generarId(): string {
  const id = `SGO-${String(siguienteNumero).padStart(6, '0')}`
  siguienteNumero += 1
  return id
}

export const mockOrderRepository: OrderRepository = {
  async createOrder(input) {
    const orden: Order = {
      id: generarId(),
      customerId: input.customerId,
      items: input.items,
      total: calcularTotal(input.items),
      metodoEntrega: input.metodoEntrega,
      estado: 'pendiente_pago',
      creadaEn: new Date().toISOString(),
    }
    ORDENES.push(orden)
    return esperar(orden)
  },
  async getOrder(id) {
    return esperar(ORDENES.find((o) => o.id === id) ?? null)
  },
  async updateEstado(id, estado) {
    const orden = ORDENES.find((o) => o.id === id)
    if (!orden) return esperar(null)
    orden.estado = estado
    return esperar(orden)
  },
}
