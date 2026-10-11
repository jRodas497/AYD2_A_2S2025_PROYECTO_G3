import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { httpConfiguracionRepository as repository } from '../api/configuracionRepository.http'
import type { Parametro } from '../types'
export function ConfiguracionPage() {
  const [settings, setSettings] = useState<Parametro[]>([])
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { repository.listSettings().then(setSettings).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])
  async function save() {
    if (!editing || saving) return
    setSaving(true); setError(null); setMessage(null)
    try { await repository.updateSetting(editing.key, editing.value); setSettings(await repository.listSettings()); setEditing(null); setMessage('Parámetro actualizado.') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el parámetro') }
    finally { setSaving(false) }
  }
  return <div>
    <h1 className="text-2xl font-semibold mb-2">Configuración</h1>
    <p className="text-sm text-gray-500 mb-4">Parámetros del sistema. La gestión de personal está en <Link className="text-brand" to="/administracion/usuarios">Usuarios y roles</Link>.</p>
    {loading && <p>Cargando configuración…</p>}{error && <p role="alert" className="text-falla mb-3">{error}</p>}{message && <p role="status" className="text-ok mb-3">{message}</p>}
    <div className="bg-white border rounded p-4 divide-y">{settings.map(setting => <div key={setting.key} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
      <div><p className="font-medium">{setting.key}</p><p className="text-xs text-gray-500">{setting.description}</p></div>
      {editing?.key === setting.key ? <div className="flex gap-2"><input aria-label={`Valor de ${setting.key}`} value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} className="border rounded px-2 w-28" /><button disabled={saving} onClick={() => void save()} className="text-brand">Guardar</button><button disabled={saving} onClick={() => setEditing(null)}>Cancelar</button></div> : <div className="flex gap-3"><span>{setting.value}</span><button onClick={() => setEditing({ key: setting.key, value: setting.value })} className="text-brand">Editar</button></div>}
    </div>)}</div>
  </div>
}
