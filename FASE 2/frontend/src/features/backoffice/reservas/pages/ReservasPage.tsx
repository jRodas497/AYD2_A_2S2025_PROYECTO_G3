import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../../shared/components/Pill'
import { httpReservasRepository } from '../api/reservasRepository.http'
import type { ReservaStock } from '../types'

const TONO_ESTADO: Record<ReservaStock['estado'], 'ok' | 'alerta' | 'falla' | 'info'> = {
  ACTIVE: 'info',
  CONFIRMED: 'ok',
  RELEASED: 'alerta',
  EXPIRED: 'falla',
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ReservasPage() {
  const [estado, setEstado] = useState('ACTIVE')
  const [reservas, setReservas] = useState<ReservaStock[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    httpReservasRepository
      .search({ status: estado || undefined, limit: 100 })
      .then(setReservas)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las reservas'))
      .finally(() => setCargando(false))
  }, [estado])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Reservas de stock</h1>
      <p className="text-sm text-gray-500 mb-6">
        Unidades apartadas por un checkout en curso (20 minutos por defecto) y las que ya se liberaron por expiración
        o se confirmaron con un cobro aprobado.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="EXPIRED">Expiradas</option>
          <option value="RELEASED">Liberadas</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando reservas…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : reservas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin reservas con ese filtro.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {reservas.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <Link to={`/administracion/ordenes/${r.orderId}`} className="font-medium text-brand hover:underline">
                Orden {r.orderId}
              </Link>
              <span className="text-gray-500 flex-1 px-3 truncate">
                {r.productoNombre} <span className="text-xs text-gray-400">({r.sku})</span>
              </span>
              <span className="text-xs text-gray-400">{r.ubicacion}</span>
              <span>{r.cantidad} u.</span>
              <span className="text-xs text-gray-400">expira {formatFecha(r.expiraEn)}</span>
              <Pill tone={TONO_ESTADO[r.estado]}>{r.estado}</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
