import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../../shared/components/Button'
import { Pill } from '../../../../shared/components/Pill'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpShipmentsRepository } from '../api/shipmentsRepository.http'
import type { Shipment } from '../types'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SeguimientoPage() {
  const [params] = useSearchParams()
  const [orderId, setOrderId] = useState(params.get('orden') ?? '')
  const [envio, setEnvio] = useState<Shipment | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevoOrigen, setNuevoOrigen] = useState('')
  const [reasignando, setReasignando] = useState(false)
  const { notificar } = useNotify()

  async function buscar(id: string) {
    if (!id.trim()) return
    setCargando(true)
    setError(null)
    setEnvio(null)
    try {
      const resultado = await httpShipmentsRepository.byOrder(id.trim())
      if (!resultado) {
        setError(`La orden ${id.trim()} todavía no tiene envío.`)
      } else {
        setEnvio(resultado)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el envío')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (params.get('orden')) buscar(params.get('orden')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reasignarOrigen() {
    if (!envio || !nuevoOrigen.trim()) return
    setReasignando(true)
    try {
      const actualizado = await httpShipmentsRepository.reassignOrigin(envio.id, nuevoOrigen.trim().toUpperCase())
      setEnvio(actualizado)
      setNuevoOrigen('')
      notificar('Punto de despacho reasignado.', 'ok')
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo reasignar el origen', 'falla')
    } finally {
      setReasignando(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Seguimiento de envíos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Busca por número de orden para ver el envío completo: origen, transportista, guía y cada cambio de estado.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar(orderId)
        }}
        className="flex gap-2 mb-6"
      >
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Número de orden"
          className="flex-1 border border-linea rounded px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={cargando}>
          {cargando ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {error && <p className="text-sm text-falla mb-4">{error}</p>}

      {envio && (
        <div className="space-y-4">
          <div className="bg-white border border-linea rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-ink">Envío {envio.id} — orden {envio.orderId}</h2>
              <Pill tone="info">{envio.estado}</Pill>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Origen</dt>
                <dd className="text-ink">{envio.origenUbicacion}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Transportista</dt>
                <dd className="text-ink">{envio.transportista}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Guía</dt>
                <dd className="text-ink">{envio.numeroGuia ?? 'sin guía todavía'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Última actualización</dt>
                <dd className="text-ink">{formatFecha(envio.actualizadoEn)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-linea rounded p-4">
            <h3 className="text-sm font-medium text-ink mb-3">Línea de tiempo</h3>
            <div className="space-y-2">
              {envio.seguimiento.map((evento, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-32 text-xs text-gray-400 flex-shrink-0">{formatFecha(evento.ocurrioEn)}</span>
                  <div>
                    <span className="font-medium text-ink">{evento.estado}</span>
                    {evento.detalle && <p className="text-xs text-gray-500">{evento.detalle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-linea rounded p-4">
            <h3 className="text-sm font-medium text-ink mb-3">Cambiar punto de despacho</h3>
            <p className="text-xs text-gray-500 mb-3">
              Solo mientras la mercancía no haya salido (CDU-04, flujo 1a). Si ya tenía guía, se anula y se pide una
              nueva desde el nuevo origen.
            </p>
            <div className="flex gap-2">
              <input
                value={nuevoOrigen}
                onChange={(e) => setNuevoOrigen(e.target.value)}
                placeholder="Código de ubicación, ej. CD1 o T-014"
                className="flex-1 border border-linea rounded px-3 py-2 text-sm"
              />
              <Button variant="secondary" disabled={reasignando || !nuevoOrigen.trim()} onClick={reasignarOrigen}>
                {reasignando ? 'Reasignando…' : 'Reasignar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
