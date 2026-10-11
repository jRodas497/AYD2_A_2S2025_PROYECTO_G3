import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { useAuth } from '../../../shared/context/AuthContext'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { STAFF_ROLES, ROLE_LABELS } from '../../../shared/auth/accessPolicy'
import { httpConfiguracionRepository as repository } from '../configuracion/api/configuracionRepository.http'
import type { RolSistema, UsuarioSistema } from '../configuracion/types'
interface Store { id: number; code: string; name: string; type_id: number }
const empty = { username: '', fullName: '', email: '', password: '', storeId: '' }
export function UsuariosPage() {
  const { session, refreshSession } = useAuth()
  const [users, setUsers] = useState<UsuarioSistema[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [form, setForm] = useState(empty)
  const [roles, setRoles] = useState<RolSistema[]>(['STORE_EMPLOYEE'])
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [resetId, setResetId] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  async function load() {
    try {
      const [u, s] = await Promise.all([repository.listUsers(), manejarRespuesta<Store[]>(await apiFetch('/api/inventory/locations'))])
      setUsers(u); setStores(s.filter(store => store.type_id === 2))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el personal') }
  }
  useEffect(() => { void load() }, [])
  function clear() { setEditing(null); setForm(empty); setRoles(['STORE_EMPLOYEE']) }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || !roles.length) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const details = { fullName: form.fullName, email: form.email.trim() || null, storeId: form.storeId ? Number(form.storeId) : null, roles }
      if (editing !== null) await repository.updateUser(editing, details)
      else await repository.createUser({ ...details, email: form.email.trim(), username: form.username.trim(), password: form.password })
      setMessage(editing !== null ? 'Usuario y roles actualizados.' : 'Usuario creado.')
      clear(); await load(); await refreshSession()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario') }
    finally { setBusy(false) }
  }
  async function active(user: UsuarioSistema) {
    if (busy) return
    setBusy(true); setError(null); setMessage(null)
    try { await repository.setActive(user.id, !user.active); setMessage(user.active ? 'Usuario deshabilitado y sesiones revocadas.' : 'Usuario activado. Debe iniciar una nueva sesión.'); await load(); await refreshSession() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado') }
    finally { setBusy(false) }
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault(); if (busy || resetId === null) return
    setBusy(true); setError(null); setMessage(null)
    try { await repository.resetPassword(resetId, password); setPassword(''); setResetId(null); setMessage('Contraseña restablecida. Las sesiones anteriores fueron revocadas.'); await refreshSession() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña') }
    finally { setBusy(false) }
  }
  return <div>
    <h1 className="text-2xl font-semibold mb-2">Usuarios y roles</h1>
    <p className="text-sm text-gray-500 mb-5">Gestiona el personal interno. Las cuentas de compradores se consultan en Clientes.</p>
    {error && <p role="alert" className="text-falla mb-3">{error}</p>}
    {message && <p role="status" className="text-ok mb-3">{message}</p>}
    <form onSubmit={save} className="bg-white border rounded p-4 mb-5">
      <h2 className="font-medium mb-3">{editing === null ? 'Crear usuario' : 'Editar usuario'}</h2>
      <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">Usuario<input required disabled={editing !== null} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="border rounded p-2 w-full" /></label>
        <label className="text-sm">Nombre completo<input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="border rounded p-2 w-full" /></label>
        <label className="text-sm">Correo<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded p-2 w-full" /></label>
        <label className="text-sm">Tienda asignada<select value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} className="border rounded p-2 w-full"><option value="">Sin tienda asignada</option>{stores.map(store => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}</select></label>
        {editing === null && <label className="text-sm">Contraseña inicial<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="border rounded p-2 w-full" /></label>}
      </fieldset>
      <fieldset disabled={busy} className="my-4"><legend className="text-sm font-medium mb-2">Roles de acceso</legend><div className="flex flex-wrap gap-4">{STAFF_ROLES.map(role => <label key={role} className="text-sm flex gap-2 items-center"><input type="checkbox" checked={roles.includes(role)} onChange={e => setRoles(previous => e.target.checked ? [...previous, role] : previous.filter(r => r !== role))} />{ROLE_LABELS[role]}</label>)}</div></fieldset>
      <Button type="submit" disabled={busy || !roles.length}>{busy ? 'Guardando…' : editing === null ? 'Crear usuario' : 'Guardar usuario'}</Button>
      {editing !== null && <button type="button" disabled={busy} onClick={clear} className="ml-4 text-brand">Cancelar edición</button>}
    </form>
    {resetId !== null && <form onSubmit={reset} className="bg-white border rounded p-4 mb-4"><h2 className="font-medium mb-3">Restablecer contraseña de {users.find(user => user.id === resetId)?.username}</h2><label className="block text-sm mb-3">Nueva contraseña<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="border rounded p-2 w-full" /></label><Button type="submit" disabled={busy}>Restablecer contraseña</Button><button type="button" disabled={busy} onClick={() => { setResetId(null); setPassword('') }} className="ml-4 text-brand">Cancelar</button></form>}
    <div className="bg-white border rounded divide-y">{users.map(user => <div key={user.id} data-testid={`staff-${user.username}`} className="p-4 flex flex-wrap gap-3 items-center">
      <div className="flex-1 min-w-40"><p className="font-medium">{user.fullName}</p><p className="text-sm text-gray-500">{user.username} · {user.roles.map(role => ROLE_LABELS[role]).join(', ')}</p><p className="text-xs text-gray-500">{user.email ?? ''}{user.storeId && ` · ${stores.find(store => store.id === user.storeId)?.code ?? user.storeId}`}</p></div>
      <span className={user.active ? 'text-ok' : 'text-falla'}>{user.active ? 'Activo' : 'Deshabilitado'}</span>
      <button disabled={busy} className="text-brand text-sm" onClick={() => { setEditing(user.id); setForm({ username: user.username, fullName: user.fullName, email: user.email ?? '', password: '', storeId: user.storeId ? String(user.storeId) : '' }); setRoles(user.roles); setMessage(null) }}>Editar usuario</button>
      <button disabled={busy} className="text-brand text-sm" onClick={() => { setResetId(user.id); setPassword('') }}>Restablecer contraseña</button>
      <button disabled={busy || user.username === session?.username} className="text-brand text-sm disabled:opacity-40" onClick={() => void active(user)}>{user.active ? 'Deshabilitar' : 'Activar'}</button>
    </div>)}</div>
  </div>
}
