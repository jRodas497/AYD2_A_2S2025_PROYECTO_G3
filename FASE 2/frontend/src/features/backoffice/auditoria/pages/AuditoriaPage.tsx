import { useEffect, useState } from 'react'
import { httpAuditoriaRepository } from '../api/auditoriaRepository.http'
import type { AuditEntry } from '../types'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function AuditoriaPage() {
  const [orderId, setOrderId] = useState('')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [entradas, setEntradas] = useState<AuditEntry[]>([])
  const [expandido, setExpandido] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    setCargando(true)
    setError(null)
    try {
      const resultado = await httpAuditoriaRepository.search({
        orderId: orderId.trim() || undefined,
        entityType: entityType.trim() || undefined,
        action: action.trim() || undefined,
        limit: 100,
      })
      setEntradas(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar la auditoría')
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
      <h1 className="text-2xl font-semibold text-ink mb-1">Auditoría</h1>
      <p className="text-sm text-gray-500 mb-6">
        Cada operación relevante (pago, factura, despacho, devolución) queda aquí, con quién, cuándo y qué cambió.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="bg-white border border-linea rounded p-4 mb-4 grid grid-cols-3 gap-3"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Orden</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ej. 12"
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo de entidad</label>
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="ej. payment_attempt, invoice, shipment"
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Acción</label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="ej. COBRO_APPROVED"
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-3">
          <button type="submit" className="text-sm text-brand hover:underline">
            Buscar
          </button>
        </div>
      </form>

      {cargando ? (
        <p className="text-sm text-gray-400">Consultando auditoría…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : entradas.length === 0 ? (
        <p className="text-sm text-gray-400">No hay registros con esos filtros.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {entradas.map((entrada) => (
            <div key={entrada.id} className="p-3">
              <button
                onClick={() => setExpandido(expandido === entrada.id ? null : entrada.id)}
                className="w-full flex items-center justify-between gap-3 text-sm text-left"
              >
                <span className="font-medium text-ink">{entrada.accion}</span>
                <span className="text-xs text-gray-400">
                  {entrada.tipoEntidad} #{entrada.idEntidad}
                </span>
                <span className="text-xs text-gray-400">{entrada.orderId ? `orden ${entrada.orderId}` : '—'}</span>
                <span className="text-xs text-gray-400">{entrada.actor}</span>
                <span className="text-xs text-gray-400">{formatFecha(entrada.ocurrioEn)}</span>
              </button>
              {expandido === entrada.id && (
                <pre className="mt-2 bg-crema/60 rounded p-2 text-xs text-gray-600 overflow-x-auto">
                  {JSON.stringify(entrada.detalle, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
