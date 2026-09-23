import type { OrderRepository } from './orderRepository'
import type { CrearOrdenInput, Order } from '../types'

const LATENCIA_MS = 200
export const ORDERS_STORAGE_KEY = 'sgo-orders'
export const RESOLUCION_EN_PROCESO_MS = 4000

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function cargarOrdenes(): Order[] {
  const crudo = localStorage.getItem(ORDERS_STORAGE_KEY)
  if (!crudo) return []
  try {
    return JSON.parse(crudo) as Order[]
  } catch {
    return []
  }
}

function guardarOrdenes(ordenes: Order[]): void {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordenes))
}

function calcularTotal(items: CrearOrdenInput['items']): number {
  return items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)
}

function generarId(ordenes: Order[]): string {
  const maximo = ordenes.reduce((max, o) => {
    const numero = Number(o.id.replace('SGO-', ''))
    return Number.isFinite(numero) && numero > max ? numero : max
  }, 0)
  return `SGO-${String(maximo + 1).padStart(6, '0')}`
}

/**
 * Si una orden lleva más del umbral en "pago en proceso", se resuelve a "pagada" al leerla.
 * Sin esto, recargar la página mientras el pago está en proceso pierde el setTimeout en
 * memoria de paymentRepository y la orden quedaría "en proceso" para siempre.
 */
function resolverSiCorresponde(orden: Order): Order {
  if (orden.estado !== 'pago_en_proceso' || !orden.enProcesoDesde) return orden
  const transcurrido = Date.now() - new Date(orden.enProcesoDesde).getTime()
  if (transcurrido >= RESOLUCION_EN_PROCESO_MS) {
    return { ...orden, estado: 'pagada', enProcesoDesde: undefined }
  }
  return orden
}

export const mockOrderRepository: OrderRepository = {
  async createOrder(input) {
    const ordenes = cargarOrdenes()
    const orden: Order = {
      id: generarId(ordenes),
      customerId: input.customerId,
      items: input.items,
      total: calcularTotal(input.items),
      metodoEntrega: input.metodoEntrega,
      estado: 'pendiente_pago',
      creadaEn: new Date().toISOString(),
    }
    ordenes.push(orden)
    guardarOrdenes(ordenes)
    return esperar(orden)
  },

  async getOrder(id) {
    const ordenes = cargarOrdenes()
    const encontrada = ordenes.find((o) => o.id === id)
    if (!encontrada) return esperar(null)

    const resuelta = resolverSiCorresponde(encontrada)
    if (resuelta !== encontrada) {
      guardarOrdenes(ordenes.map((o) => (o.id === id ? resuelta : o)))
    }
    return esperar(resuelta)
  },

  async updateEstado(id, estado) {
    const ordenes = cargarOrdenes()
    const idx = ordenes.findIndex((o) => o.id === id)
    if (idx === -1) return esperar(null)

    ordenes[idx] = {
      ...ordenes[idx],
      estado,
      enProcesoDesde: estado === 'pago_en_proceso' ? new Date().toISOString() : undefined,
    }
    guardarOrdenes(ordenes)
    return esperar(ordenes[idx])
  },

  async listOrders(customerId) {
    const ordenes = cargarOrdenes()
      .filter((o) => o.customerId === customerId)
      .map(resolverSiCorresponde)
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    return esperar(ordenes)
  },
}
