import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpNotificacionesAdminRepository, type NotificacionAdmin } from '../api/notificacionesAdminRepository.http'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NotificacionesAdminPage() {
  const [estado, setEstado] = useState('FAILED')
  const [avisos, setAvisos] = useState<NotificacionAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { notificar } = useNotify()

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setAvisos(await httpNotificacionesAdminRepository.byStatus(estado, 100))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  async function reintentar(id: number) {
    try {
      await httpNotificacionesAdminRepository.retry(id)
      notificar(`Aviso ${id} vuelto a encolar para reintento.`, 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo reintentar el aviso', 'falla')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Notificaciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Avisos al cliente por SMS, correo o push. Una falla del proveedor de mensajería no bloquea la orden, pero
        queda aquí para reintentarse a mano.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          <option value="FAILED">Fallidos</option>
          <option value="PENDING">Pendientes</option>
          <option value="DELIVERED">Entregados</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : avisos.length === 0 ? (
        <p className="text-sm text-gray-400">Sin avisos con ese filtro.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {avisos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <Link to={`/ordenes/${a.orderId}`} className="font-medium text-brand hover:underline flex-shrink-0">
                Orden {a.orderId}
              </Link>
              <span className="text-xs text-gray-400">{a.channel}</span>
              <span className="text-gray-600 flex-1 px-3 truncate">{a.message}</span>
              <span className="text-xs text-gray-400">{a.attempts} intentos</span>
              <span className="text-xs text-gray-400">{formatFecha(a.createdAt)}</span>
              {a.status === 'FAILED' && (
                <button onClick={() => reintentar(a.id)} className="text-xs text-brand hover:underline">
                  Reintentar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
