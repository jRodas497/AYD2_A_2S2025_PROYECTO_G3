import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { mockOrderRepository } from '../api/orderRepository.mock'
import type { Order } from '../types'

const ETIQUETA_ENTREGA: Record<Order['metodoEntrega'], string> = {
  centro_distribucion: 'Centro de distribución',
  tienda: 'Tienda',
  recogida: 'Recogida',
}

const ETIQUETA_ESTADO: Record<Order['estado'], { texto: string; tono: 'ok' | 'alerta' | 'falla' | 'info' }> = {
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'alerta' },
  pago_en_proceso: { texto: 'Pago en proceso', tono: 'info' },
  pagada: { texto: 'Pagada', tono: 'ok' },
  pago_fallido: { texto: 'Pago fallido', tono: 'falla' },
}

const INTERVALO_SONDEO_MS = 2000

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [orden, setOrden] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelado = false

    async function consultar() {
      const resultado = await mockOrderRepository.getOrder(id!)
      if (cancelado) return
      setOrden(resultado)
      setCargando(false)
    }

    consultar()

    // Mientras el pago está en proceso, se sondea sin bloquear la UI (el backend real resuelve
    // el reintento de forma asíncrona vía outbox/circuit breaker — CDU-02).
    const intervalo = setInterval(() => {
      if (!cancelado) consultar()
    }, INTERVALO_SONDEO_MS)

    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
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

      <p className="text-sm text-gray-500 mb-4">Entrega: {ETIQUETA_ENTREGA[orden.metodoEntrega]}</p>

      {orden.estado === 'pendiente_pago' && (
        <Link to={`/ordenes/${orden.id}/pago`}>
          <Button>Pagar ahora</Button>
        </Link>
      )}

      {orden.estado === 'pago_en_proceso' && (
        <p className="text-sm text-gray-400">
          Estamos confirmando tu pago. Esta página se actualiza sola cuando tengamos el resultado.
        </p>
      )}

      {orden.estado === 'pago_fallido' && (
        <p className="text-sm text-falla">
          Se agotaron los intentos de cobro. Te notificaremos para que puedas reintentar más tarde.
        </p>
      )}
    </div>
  )
}
