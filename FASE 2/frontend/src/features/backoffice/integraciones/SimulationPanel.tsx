import { useEffect, useState } from 'react'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { useAuth } from '../../../shared/context/AuthContext'
export function SimulationPanel() {
  const { isAdmin } = useAuth()
  const [modes, setModes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  async function load() {
    try { setModes(await manejarRespuesta<Record<string, string>>(await apiFetch('/api/simulation'))); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar a los proveedores') }
  }
  useEffect(() => { if (isAdmin) { void load(); const timer = setInterval(() => void load(), 10000); return () => clearInterval(timer) } }, [isAdmin])
  async function change(provider: string, mode: string) {
    setBusy(provider)
    try { setModes(await manejarRespuesta<Record<string, string>>(await apiFetch(`/api/simulation/${provider}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }))) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el proveedor') }
    finally { setBusy(null) }
  }
  if (!isAdmin) return null
  return <section className="bg-white border rounded p-4 mb-4"><h2 className="font-medium mb-2">Proveedores de demostración</h2>
    <p className="text-xs text-gray-500 mb-3">Cada proveedor corre en su propio contenedor. Los modos permiten verificar demoras, rechazos y recuperación.</p>
    {error && <p role="alert" className="text-falla">{error}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(modes).map(([provider, mode]) => <label key={provider} className="text-sm flex justify-between items-center gap-2">{provider}
      <select aria-label={`Modo ${provider}`} value={mode} disabled={busy !== null || mode === 'OFFLINE'} onChange={e => void change(provider, e.target.value)} className="border rounded p-2">
        {['NORMAL', 'SLOW', 'DOWN', 'REJECT', ...(mode === 'OFFLINE' ? ['OFFLINE'] : [])].map(m => <option key={m}>{m}</option>)}
      </select></label>)}</div>
  </section>
}
