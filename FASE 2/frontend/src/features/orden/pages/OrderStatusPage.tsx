import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { BackLink } from '../../../shared/components/BackLink'
import { mockOrderRepository } from '../api/orderRepository.mock'
import type { Order } from '../types'

const ETIQUETA_ENTREGA: Record<Order['metodoEntrega'], string> = {
  centro_distribucion: 'Centro de distribución',
  tienda: 'Tienda',
  recogida: 'Recogida',
}

const ETIQUETA_ESTADO: Record<Order['estado'], { texto: string; tono: 'ok' | 'alerta' | 'falla' }> = {
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'alerta' },
  pagada: { texto: 'Pagada', tono: 'ok' },
  pago_fallido: { texto: 'Pago fallido', tono: 'falla' },
}

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [orden, setOrden] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!id) return
    mockOrderRepository.getOrder(id).then((resultado) => {
      setOrden(resultado)
      setCargando(false)
    })
  }, [id])

  if (cargando) return <p className="text-sm text-gray-400">Cargando orden…</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  const estado = ETIQUETA_ESTADO[orden.estado]

  return (
    <div>
      <BackLink to="/catalogo" label="Seguir comprando" />
      <h1 className="text-2xl font-semibold text-ink mb-1">Orden {orden.id}</h1>
      <Pill tone={estado.tono}>{estado.texto}</Pill>

      <div className="bg-white border border-linea rounded p-4 mt-4 mb-4">
        <div className="divide-y divide-linea">
          {orden.items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <div className="text-sm">{item.nombre}</div>
                <div className="text-xs text-gray-400">{item.sku}</div>
              </div>
              <div className="text-sm text-gray-500 w-16">{item.cantidad}</div>
              <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold border-t border-linea mt-3 pt-3 text-sm">
          <span>Total</span>
          <span>{formatQ(orden.total)}</span>
        </div>
      </div>

      <p className="text-sm text-gray-500">Entrega: {ETIQUETA_ENTREGA[orden.metodoEntrega]}</p>

      {orden.estado === 'pendiente_pago' && (
        <p className="text-sm text-gray-400 mt-3">
          El pago de esta orden se habilita en la próxima entrega (PB-010).
        </p>
      )}
    </div>
  )
}
