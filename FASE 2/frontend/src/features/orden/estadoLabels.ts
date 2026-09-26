import type { Order } from './types'

export const ETIQUETA_ESTADO: Record<Order['estado'], { texto: string; tono: 'ok' | 'alerta' | 'falla' | 'info' }> = {
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'alerta' },
  pago_en_proceso: { texto: 'Pago en proceso', tono: 'info' },
  pagada: { texto: 'Pagada', tono: 'ok' },
  pago_fallido: { texto: 'Pago fallido', tono: 'falla' },
  facturada: { texto: 'Factura generada', tono: 'info' },
  en_despacho: { texto: 'En despacho', tono: 'info' },
  entregada: { texto: 'Entregada', tono: 'ok' },
  cancelada: { texto: 'Cancelada', tono: 'falla' },
  devuelta: { texto: 'Devuelta', tono: 'alerta' },
}

export const ESTADOS_TERMINALES: Order['estado'][] = ['entregada', 'cancelada', 'devuelta']
