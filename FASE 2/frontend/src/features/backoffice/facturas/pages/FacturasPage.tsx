import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../../shared/components/Pill'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpFacturasRepository, type FacturaAdmin } from '../api/facturasRepository.http'

const TONO_ESTADO: Record<FacturaAdmin['status'], 'ok' | 'alerta' | 'falla' | 'info'> = {
  GENERATED: 'info',
  SENT: 'alerta',
  ACCEPTED: 'ok',
  REJECTED: 'falla',
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function FacturasPage() {
  const [estado, setEstado] = useState('REJECTED')
  const [facturas, setFacturas] = useState<FacturaAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<Set<number>>(new Set())
  const { notificar } = useNotify()

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setFacturas(await httpFacturasRepository.byStatus(estado, 100))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las facturas')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  async function reintentar(orderId: number) {
    if (pendientes.has(orderId)) return
    setPendientes((actual) => new Set(actual).add(orderId))
    try {
      await httpFacturasRepository.reintentar(orderId)
      notificar(`Factura de la orden ${orderId} reintentada.`, 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'La SAT volvió a rechazar o no respondió', 'falla')
    } finally {
      setPendientes((actual) => {
        const copia = new Set(actual)
        copia.delete(orderId)
        return copia
      })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Facturas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bandeja de Finanzas: documentos rechazados por la SAT o pendientes de respuesta. Ninguna orden se despacha
        sin una factura aceptada.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          <option value="REJECTED">Rechazadas</option>
          <option value="SENT">Enviadas, sin respuesta</option>
          <option value="GENERATED">Generadas</option>
          <option value="ACCEPTED">Aceptadas</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : facturas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin facturas con ese filtro.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {facturas.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <Link to={`/administracion/ordenes/${f.orderId}`} className="font-medium text-brand hover:underline flex-shrink-0">
                Orden {f.orderId}
              </Link>
              <span className="text-xs text-gray-400">{f.cui}</span>
              <span className="text-gray-600 flex-1 px-3 truncate">{f.satResponse ?? 'sin respuesta de la SAT'}</span>
              <span className="text-xs text-gray-400">{formatFecha(f.generatedAt)}</span>
              <Pill tone={TONO_ESTADO[f.status]}>{f.status}</Pill>
              {f.status !== 'ACCEPTED' && (
                <button
                  onClick={() => reintentar(f.orderId)}
                  disabled={pendientes.has(f.orderId)}
                  className="text-xs text-brand hover:underline disabled:opacity-50"
                >
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
