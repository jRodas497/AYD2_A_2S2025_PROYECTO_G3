import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../../shared/components/Pill'
import { httpOrdenesRepository, type OrdenBackoffice } from '../api/ordenesRepository.http'
import { mapearEstado } from '../../../orden/api/orderRepository.http'
import { ETIQUETA_ESTADO } from '../../../orden/estadoLabels'

const ESTADOS = [
  'PENDING_PAYMENT',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_FAILED',
  'PAID',
  'INVOICED',
  'IN_DISPATCH',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

function formatFecha(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function OrdenesPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [ordenes, setOrdenes] = useState<OrdenBackoffice[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    setCargando(true)
    setError(null)
    try {
      setOrdenes(await httpOrdenesRepository.search({ q: q.trim() || undefined, status: status || undefined, limit: 100 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las órdenes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Órdenes</h1>
      <p className="text-sm text-gray-500 mb-6">Todas las órdenes del sistema, de cualquier canal.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Número de orden o nombre de cliente…"
          className="flex-1 border border-linea rounded px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>
              {ETIQUETA_ESTADO[mapearEstado(s)].texto}
            </option>
          ))}
        </select>
        <button type="submit" className="text-sm text-brand hover:underline px-2">
          Buscar
        </button>
      </form>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando órdenes…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : ordenes.length === 0 ? (
        <p className="text-sm text-gray-400">Sin órdenes con esos filtros.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {ordenes.map((orden) => {
            const etiqueta = ETIQUETA_ESTADO[orden.estado]
            return (
              <Link
                key={orden.id}
                to={`/ordenes/${orden.id}`}
                className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-crema/40"
              >
                <span className="font-medium text-ink">Orden {orden.id}</span>
                <span className="text-gray-500 flex-1 px-3 truncate">{orden.cliente}</span>
                <span className="text-xs text-gray-400">{orden.canal}</span>
                <span className="text-xs text-gray-400">{formatFecha(orden.creadaEn)}</span>
                <span className="w-20 text-right">{formatQ(orden.total)}</span>
                <Pill tone={etiqueta.tono}>{etiqueta.texto}</Pill>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
