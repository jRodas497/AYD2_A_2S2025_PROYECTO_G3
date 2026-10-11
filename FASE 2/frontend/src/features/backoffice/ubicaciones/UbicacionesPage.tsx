import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { LOCATION_LABEL, locationRequest, type Location } from './locationApi'
const empty = { code: '', name: '', type: 'WAREHOUSE', address: '' }
export function UbicacionesPage() {
 const [locations, setLocations] = useState<Location[]>([])
 const [form, setForm] = useState(empty)
 const [editing, setEditing] = useState<number | null>(null)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const { notificar } = useNotify()
 async function load() { setLocations(await locationRequest<Location[]>('/api/inventory/locations/manage')) }
 useEffect(() => { let disposed=false;void locationRequest<Location[]>('/api/inventory/locations/manage').then(rows=>{if(!disposed)setLocations(rows)}).catch(e=>{if(!disposed)setError(e.message)});return()=>{disposed=true} }, [])
 async function save(e: React.FormEvent) {
  e.preventDefault(); if (busy) return; setBusy(true); setError('')
  try {
   await locationRequest(`/api/inventory/locations${editing ? `/${editing}` : ''}`, editing ? 'PUT' : 'POST', form)
   setEditing(null); setForm(empty); await load(); notificar('Ubicación guardada.', 'ok')
  } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setBusy(false) }
 }
 async function active(location: Location) {
  setBusy(true); setError('')
  try { await locationRequest(`/api/inventory/locations/${location.id}/active`, 'PUT', { active: !location.active }); await load() }
  catch(e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado') } finally { setBusy(false) }
 }
 return <div className="space-y-5">
  <h1 className="text-2xl font-semibold">Bodegas y puntos de distribución</h1>
  <p>Registra bodegas, centros de distribución y tiendas. Para desactivar una ubicación debe quedar sin mercancía, operaciones pendientes ni personal activo.</p>
  {error && <p role="alert" className="text-falla">{error}</p>}
  <form onSubmit={save} className="bg-white border rounded p-4 space-y-3">
   <h2 className="font-semibold">{editing ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
   <div className="grid md:grid-cols-2 gap-3">
    <label>Código<input required pattern="[A-Z0-9][A-Z0-9-]{1,29}" maxLength={30} disabled={!!editing} value={form.code} onChange={e => setForm({...form, code:e.target.value.toUpperCase()})} className="block border rounded p-2 w-full" /></label>
    <label>Nombre<input required maxLength={120} value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="block border rounded p-2 w-full" /></label>
    <label>Tipo<select aria-label="Tipo" disabled={!!editing} value={form.type} onChange={e => setForm({...form,type:e.target.value})} className="block border rounded p-2 w-full"><option value="WAREHOUSE">Bodega</option><option value="DISTRIBUTION_CENTER">Centro de distribución</option><option value="STORE">Tienda</option></select></label>
    <label>Dirección<input required maxLength={300} value={form.address} onChange={e => setForm({...form,address:e.target.value})} className="block border rounded p-2 w-full" /></label>
   </div>
   <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar ubicación'}</Button>
   {editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null);setForm(empty) }}>Cancelar edición</Button>}
  </form>
  <div className="overflow-x-auto bg-white border rounded"><table className="w-full text-sm"><thead><tr>{['Código','Nombre','Tipo','Dirección','Estado','Acciones'].map(h=><th className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{locations.map(l=><tr key={l.id} className="border-t"><td className="p-3">{l.code}</td><td>{l.name}</td><td>{LOCATION_LABEL[l.type_id]}</td><td>{l.address || 'Sin dirección registrada'}</td><td>{l.active ? 'Activa':'Inactiva'}</td><td className="flex gap-2 p-2"><Button disabled={busy} variant="secondary" onClick={() => { setEditing(l.id);setForm({code:l.code,name:l.name,type:l.type!,address:l.address});setError('') }}>Editar</Button><Button disabled={busy} variant="secondary" onClick={() => void active(l)}>{l.active?'Desactivar':'Activar'}</Button></td></tr>)}</tbody></table></div>
 </div>
}
