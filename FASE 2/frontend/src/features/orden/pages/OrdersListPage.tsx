import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { mockOrderRepository } from '../api/orderRepository.mock'
import { ETIQUETA_ESTADO } from '../estadoLabels'
import type { Order } from '../types'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function OrdersListPage() {
  const { customer } = useCustomer()
  const [ordenes, setOrdenes] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    mockOrderRepository.listOrders(customer.id).then((resultado) => {
      setOrdenes(resultado)
      setCargando(false)
    })
  }, [customer.id])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Mis órdenes</h1>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando órdenes…</p>
      ) : ordenes.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no tienes órdenes. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {ordenes.map((orden) => {
            const estado = ETIQUETA_ESTADO[orden.estado]
            return (
              <Link
                key={orden.id}
                to={`/ordenes/${orden.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-crema/40"
              >
                <div>
                  <div className="text-sm font-medium text-ink">{orden.id}</div>
                  <div className="text-xs text-gray-400">{formatFecha(orden.creadaEn)}</div>
                </div>
                <div className="text-sm text-gray-500">{formatQ(orden.total)}</div>
                <Pill tone={estado.tono}>{estado.texto}</Pill>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
