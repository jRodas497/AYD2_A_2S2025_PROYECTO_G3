import { useAuth } from '../../../../shared/context/AuthContext'
import { hasPermission } from '../../../../shared/auth/accessPolicy'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink } from '../../../../shared/components/BackLink'
import { Button } from '../../../../shared/components/Button'
import { Pill } from '../../../../shared/components/Pill'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpClientesRepository } from '../api/clientesRepository.http'
import type { ClienteDetalle } from '../types'
import { apiFetch } from '../../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

function formatFecha(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ClienteDetallePage() {
  const { session } = useAuth()
  const canEdit = hasPermission(session?.roles ?? [], 'editCustomers')
  const { id } = useParams<{ id: string }>()
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '' })
  const [guardando, setGuardando] = useState(false)
  const { notificar } = useNotify()

  useEffect(() => {
    if (!id) return
    httpClientesRepository
      .detalle(id)
      .then((resultado) => {
        setCliente(resultado)
        setForm({ fullName: resultado.nombre, email: resultado.email, phone: resultado.telefono, address: resultado.direccion })
        setCargando(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el cliente')
        setCargando(false)
      })
  }, [id])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setGuardando(true)
    try {
      await httpClientesRepository.actualizar(id, form)
      const actualizado = await httpClientesRepository.detalle(id)
      setCliente(actualizado)
      setEditando(false)
      notificar('Datos del cliente actualizados.', 'ok')
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'No se pudo actualizar el cliente', 'falla')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (error || !cliente) return <p className="text-sm text-falla">{error ?? 'Cliente no encontrado'}</p>

  return (
    <div>
      <BackLink to="/administracion/clientes" label="Volver a clientes" />
      <h1 className="text-2xl font-semibold text-ink mb-6">{cliente.nombre}</h1>

      <div className="bg-white border border-linea rounded p-4 mb-4">
        {editando ? (
          <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Correo</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dirección</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <dt className="text-xs text-gray-400">Correo</dt>
                <dd className="text-ink">{cliente.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Teléfono</dt>
                <dd className="text-ink">{cliente.telefono || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Dirección</dt>
                <dd className="text-ink">{cliente.direccion || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">NIT / CF</dt>
                <dd className="text-ink">{cliente.taxId}</dd>
              </div>
            </dl>
            {canEdit && <Link to={`/administracion/clientes/${id}/venta`} className="block text-brand mb-3">Continuar carrito / crear venta asistida</Link>}
            {session?.roles.includes('ADMIN')&&<Button variant="secondary" disabled={guardando} onClick={async()=>{
              setGuardando(true)
              try{await manejarRespuesta(await apiFetch(`/api/customers/${cliente.id}/active`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:cliente.active===false})}));setCliente(await httpClientesRepository.detalle(cliente.id));notificar('Estado de la cuenta actualizado.','ok')}
              catch(e){notificar(e instanceof Error?e.message:'No se pudo cambiar el estado','falla')}finally{setGuardando(false)}
            }}>{cliente.active===false?'Activar cuenta':'Desactivar cuenta'}</Button>}
            {canEdit && <Button variant="secondary" onClick={() => setEditando(true)}>
              Editar datos
            </Button>}
          </div>
        )}
      </div>

      <div className="bg-white border border-linea rounded p-4 mb-4">
        <h2 className="text-sm font-medium text-ink mb-3">Órdenes</h2>
        {cliente.ordenes.length === 0 ? (
          <p className="text-sm text-gray-400">Sin órdenes registradas.</p>
        ) : (
          <div className="divide-y divide-linea">
            {cliente.ordenes.map((o) => (
              <Link
                key={o.orderId}
                to={`/administracion/ordenes/${o.orderId}`}
                className="flex items-center justify-between py-2 text-sm hover:bg-crema/40"
              >
                <span className="font-medium text-ink">Orden {o.orderId}</span>
                <span className="text-xs text-gray-400">{o.canal}</span>
                <span className="text-xs text-gray-400">{formatFecha(o.fecha)}</span>
                <span>{formatQ(o.total)}</span>
                <Pill tone="info">{o.estado}</Pill>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-linea rounded p-4">
        <h2 className="text-sm font-medium text-ink mb-3">Incidencias</h2>
        {cliente.incidencias.length === 0 ? (
          <p className="text-sm text-gray-400">Sin incidencias registradas.</p>
        ) : (
          <div className="divide-y divide-linea">
            {cliente.incidencias.map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">Orden {i.orderId}</span>
                <span className="text-xs text-gray-400">{i.tipo}</span>
                <span className="text-gray-500 flex-1 px-3 truncate">{i.descripcion}</span>
                <Pill tone="alerta">{i.estado}</Pill>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
