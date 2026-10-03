import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { httpNotificacionesRepository } from '../api/notificacionesRepository.http'
import type { NotificacionCliente } from '../types'

const TONO_ESTADO: Record<NotificacionCliente['estado'], 'ok' | 'alerta' | 'falla'> = {
  DELIVERED: 'ok',
  PENDING: 'alerta',
  FAILED: 'falla',
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NotificacionesPage() {
  const { customer } = useCustomer()
  const [notificaciones, setNotificaciones] = useState<NotificacionCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    httpNotificacionesRepository
      .misNotificaciones(customer.id)
      .then(setNotificaciones)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar tus notificaciones'))
      .finally(() => setCargando(false))
  }, [customer.id])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Notificaciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Confirmación, preparación, tránsito, entrega e incidencias de tus órdenes — así no dependes solo de SMS o
        correo, ni siquiera si ese canal falló.
      </p>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : notificaciones.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía no tienes notificaciones. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {notificaciones.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <Link to={`/ordenes/${n.orderId}`} className="font-medium text-brand hover:underline flex-shrink-0">
                Orden {n.orderId}
              </Link>
              <span className="text-gray-600 flex-1 px-3">{n.mensaje}</span>
              <span className="text-xs text-gray-400">{formatFecha(n.creadaEn)}</span>
              <Pill tone={TONO_ESTADO[n.estado]}>{n.estado}</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
