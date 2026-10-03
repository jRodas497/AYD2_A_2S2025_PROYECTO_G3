import { useEffect, useState } from 'react'
import { Pill } from '../../../../shared/components/Pill'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpIntegracionesRepository } from '../api/integracionesRepository.http'
import type { OutboxEventoVista, PosEventoVista, SaludIntegraciones } from '../types'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function TonoCircuito({ estado }: { estado: string }) {
  const tono = estado === 'CLOSED' ? 'ok' : estado === 'HALF_OPEN' ? 'alerta' : 'falla'
  return <Pill tone={tono}>{estado}</Pill>
}

export function IntegracionesPage() {
  const [salud, setSalud] = useState<SaludIntegraciones | null>(null)
  const [outbox, setOutbox] = useState<OutboxEventoVista[]>([])
  const [pos, setPos] = useState<PosEventoVista[]>([])
  const [erpBatches, setErpBatches] = useState<Record<string, unknown>[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<Set<string>>(new Set())
  const [generandoLote, setGenerandoLote] = useState(false)
  const { notificar } = useNotify()

  function marcarPendiente(clave: string, valor: boolean) {
    setPendientes((actual) => {
      const copia = new Set(actual)
      if (valor) copia.add(clave)
      else copia.delete(clave)
      return copia
    })
  }

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [s, o, p, e] = await Promise.all([
        httpIntegracionesRepository.salud(),
        httpIntegracionesRepository.outbox('FAILED', 50),
        httpIntegracionesRepository.pos('FAILED', 50),
        httpIntegracionesRepository.erpBatches(10),
      ])
      setSalud(s)
      setOutbox(o)
      setPos(p)
      setErpBatches(e)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el estado de las integraciones')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function reintentarOutbox(id: number) {
    const clave = `outbox-${id}`
    if (pendientes.has(clave)) return
    marcarPendiente(clave, true)
    try {
      await httpIntegracionesRepository.reintentarOutbox(id)
      notificar(`Evento ${id} vuelto a encolar.`, 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo reintentar', 'falla')
    } finally {
      marcarPendiente(clave, false)
    }
  }

  async function reintentarPos(id: number) {
    const clave = `pos-${id}`
    if (pendientes.has(clave)) return
    marcarPendiente(clave, true)
    try {
      await httpIntegracionesRepository.reintentarPos(id)
      notificar(`Evento de POS ${id} vuelto a encolar.`, 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo reintentar', 'falla')
    } finally {
      marcarPendiente(clave, false)
    }
  }

  async function generarLote() {
    if (generandoLote) return
    setGenerandoLote(true)
    try {
      await httpIntegracionesRepository.generarLoteErp()
      notificar('Lote del ERP generado (o no había ventas pendientes).', 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo generar el lote', 'falla')
    } finally {
      setGenerandoLote(false)
    }
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando integraciones…</p>
  if (error || !salud) return <p className="text-sm text-falla">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Integraciones</h1>
      <p className="text-sm text-gray-500 mb-6">
        Circuit breakers de los terceros y la profundidad de cada cola de reintentos (ADR-0002/ADR-0004): un
        circuito sin forma de verlo es un punto ciego, no una protección.
      </p>

      <div className="bg-white border border-linea rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-ink mb-3">Circuitos</h2>
        <div className="flex gap-4">
          {Object.entries(salud.circuitos).map(([proveedor, estado]) => (
            <div key={proveedor} className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{proveedor}</span>
              <TonoCircuito estado={estado} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['outbox', 'pos', 'avisos', 'erp'] as const).map((cola) => (
          <div key={cola} className="bg-white border border-linea rounded p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">{cola}</div>
            {Object.entries(salud[cola]).map(([estado, total]) => (
              <div key={estado} className="flex justify-between text-sm">
                <span className="text-gray-500">{estado}</span>
                <span className="font-medium text-ink">{total}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="bg-white border border-linea rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-ink mb-3">Outbox — eventos fallidos</h2>
        {outbox.length === 0 ? (
          <p className="text-sm text-gray-400">Sin eventos fallidos.</p>
        ) : (
          <div className="divide-y divide-linea">
            {outbox.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">{e.eventType}</span>
                <span className="text-xs text-gray-400">{e.aggregateType} #{e.aggregateId}</span>
                <span className="text-xs text-gray-400">{e.attempts} intentos</span>
                <span className="text-xs text-gray-400">{formatFecha(e.createdAt)}</span>
                <button
                  onClick={() => reintentarOutbox(e.id)}
                  disabled={pendientes.has(`outbox-${e.id}`)}
                  className="text-xs text-brand hover:underline disabled:opacity-50"
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-linea rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-ink mb-3">POS — eventos sin entregar</h2>
        {pos.length === 0 ? (
          <p className="text-sm text-gray-400">Sin eventos fallidos.</p>
        ) : (
          <div className="divide-y divide-linea">
            {pos.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">{e.storeCode}</span>
                <span className="text-xs text-gray-400">{e.eventType}</span>
                <span className="text-gray-500 flex-1 px-3 truncate">{e.lastError}</span>
                <span className="text-xs text-gray-400">{formatFecha(e.createdAt)}</span>
                <button
                  onClick={() => reintentarPos(e.id)}
                  disabled={pendientes.has(`pos-${e.id}`)}
                  className="text-xs text-brand hover:underline disabled:opacity-50"
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-linea rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-ink">Lotes del ERP</h2>
          <button onClick={generarLote} disabled={generandoLote} className="text-xs text-brand hover:underline disabled:opacity-50">
            {generandoLote ? 'Generando…' : 'Generar lote ahora'}
          </button>
        </div>
        {erpBatches.length === 0 ? (
          <p className="text-sm text-gray-400">Sin lotes todavía.</p>
        ) : (
          <div className="divide-y divide-linea">
            {erpBatches.map((b) => (
              <div key={String(b.id)} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">Lote {String(b.id)}</span>
                <span className="text-xs text-gray-400">{String(b.file_name ?? '')}</span>
                <span className="text-xs text-gray-400">{String(b.status ?? '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
