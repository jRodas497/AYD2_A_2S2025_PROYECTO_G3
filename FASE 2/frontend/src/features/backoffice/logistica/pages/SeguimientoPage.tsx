import { ManualTransportForm } from '../ManualTransportForm'
import { locationRequest, type Location } from '../../ubicaciones/locationApi'
import { useAuth } from '../../../../shared/context/AuthContext'
import { hasPermission } from '../../../../shared/auth/accessPolicy'
import { apiFetch } from '../../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'
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
  const { session } = useAuth()
  const canEdit = hasPermission(session?.roles ?? [], 'editShipments')
  const [params] = useSearchParams()
  const [orderId, setOrderId] = useState(params.get('orden') ?? '')
  const [envio, setEnvio] = useState<Shipment | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState('IN_TRANSIT')
  const [actualizando, setActualizando] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  useEffect(() => { void locationRequest<Location[]>('/api/inventory/locations').then(setLocations).catch(e => notificar(e.message, 'falla')) }, []) // eslint-disable-line react-hooks/exhaustive-deps
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

  async function actualizarRastreo() {
    if (!envio || actualizando) return
    setActualizando(true)
    try {
      await manejarRespuesta(await apiFetch(`/api/shipments/${envio.id}/${envio.transportista !== 'LOGIEXPRESS' ? 'tracking' : 'simulate-tracking'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nuevoEstado, detail: 'Actualización registrada por Logística' }) }))
      await buscar(orderId)
      notificar('Estado de entrega actualizado.', 'ok')
    } catch (e) { notificar(e instanceof Error ? e.message : 'No se pudo actualizar', 'falla') }
    finally { setActualizando(false) }
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
                <dd className="text-ink">{envio.carrierName ?? envio.transportista}</dd>
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

          {envio.transportista === 'MANUAL' && <p className="bg-white border rounded p-3">Conductor: {envio.driverName} · Placa: {envio.vehiclePlate} · Motivo: {envio.transportReason}</p>}
          {canEdit && envio.transportista !== 'PICKUP' && !['DELIVERED','IN_TRANSIT'].includes(envio.estado) && <ManualTransportForm shipmentId={envio.id} onSaved={() => buscar(orderId)} />}
          {canEdit && <>          <div className="bg-white border border-linea rounded p-4">
            <label htmlFor="tracking-state" className="block font-medium mb-2">Actualizar entrega</label>
            <select id="tracking-state" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)} className="border rounded p-2 mr-3">
              <option value="IN_TRANSIT">En tránsito</option><option value="DELIVERED">Entregado</option><option value="FAILED">Entrega fallida</option>
            </select>
            <Button disabled={actualizando || envio.estado === 'DELIVERED'} onClick={() => void actualizarRastreo()}>Guardar estado</Button>
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
                list="shipment-locations"
                placeholder="Selecciona el código de ubicación"
                className="flex-1 border border-linea rounded px-3 py-2 text-sm"
              />
              <datalist id="shipment-locations">{locations.map(l=><option key={l.id} value={l.code}>{l.name}</option>)}</datalist>
              <Button variant="secondary" disabled={reasignando || !nuevoOrigen.trim() || ['DELIVERED', 'IN_TRANSIT', 'FAILED'].includes(envio.estado)} onClick={reasignarOrigen}>
                {reasignando ? 'Reasignando…' : 'Reasignar'}
              </Button>
            </div>
          </div></>}
        </div>
      )}
    </div>
  )
}
