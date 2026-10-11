import { useAuth } from '../../../../shared/context/AuthContext'
import { hasPermission } from '../../../../shared/auth/accessPolicy'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../../shared/components/Button'
import { Pill } from '../../../../shared/components/Pill'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpShipmentsRepository } from '../api/shipmentsRepository.http'
import type { Shipment } from '../types'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function LogisticaPage() {
  const { session } = useAuth()
  const canEdit = hasPermission(session?.roles ?? [], 'editShipments')
  const [envios, setEnvios] = useState<Shipment[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reintentando, setReintentando] = useState<number | null>(null)
  const { notificar } = useNotify()

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setEnvios(await httpShipmentsRepository.byStatus('GUIDE_REQUESTED', 100))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las alertas de logística')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function reintentarGuia(id: number) {
    setReintentando(id)
    try {
      await httpShipmentsRepository.requestGuide(id)
      notificar(`Guía solicitada de nuevo para el envío ${id}.`, 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'LogiExpress no respondió; sigue en la cola', 'falla')
    } finally {
      setReintentando(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Logística</h1>
      <p className="text-sm text-gray-500 mb-6">
        Envíos ya asignados que se quedaron sin número de guía tras agotar los reintentos automáticos con
        LogiExpress (CDU-04, E1). Requieren asignación manual de transporte.
      </p>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando alertas…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : envios.length === 0 ? (
        <p className="text-sm text-gray-400">Sin alertas: todos los envíos asignados ya tienen guía.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {envios.map((envio) => (
            <div key={envio.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <Link to={`/administracion/seguimiento?orden=${envio.orderId}`} className="text-sm font-medium text-brand hover:underline">
                  Orden {envio.orderId}
                </Link>
                <div className="text-xs text-gray-400">Envío {envio.id} · origen {envio.origenUbicacion}</div>
              </div>
              <div className="text-xs text-gray-400">{formatFecha(envio.actualizadoEn)}</div>
              <Pill tone="alerta">{envio.estado}</Pill>
              {canEdit && <Button variant="secondary" disabled={reintentando === envio.id} onClick={() => reintentarGuia(envio.id)}>
                {reintentando === envio.id ? 'Pidiendo…' : 'Pedir guía de nuevo'}
              </Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
