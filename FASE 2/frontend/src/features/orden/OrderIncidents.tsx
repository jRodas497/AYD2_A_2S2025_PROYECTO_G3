import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/context/AuthContext'
import { hasPermission } from '../../shared/auth/accessPolicy'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../shared/api/apiFetch'
import { manejarRespuesta } from '../../shared/api/httpErrors'
import { Button } from '../../shared/components/Button'
interface Incident { id: number; type: string; description: string; status: string }
interface Refund { id: number; amount: number; status: string; provider_reference: string | null }
export function OrderIncidents({ orderId }: { orderId: string }) {
  const staffArea = useLocation().pathname.startsWith('/administracion')
  const { session } = useAuth()
  const canRegister = !staffArea || hasPermission(session?.roles ?? [], 'editCustomers')
  const [rows, setRows] = useState<Incident[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [type, setType] = useState('RETURN')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [incidents, payments] = await Promise.all([
          apiFetch(`/api/orders/${orderId}/incidents`).then(r => manejarRespuesta<Incident[]>(r)),
          apiFetch(`/api/orders/${orderId}/refunds`).then(r => manejarRespuesta<Refund[]>(r)),
        ])
        if (active) { setRows(incidents); setRefunds(payments) }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'No se pudo consultar la solicitud') }
    }
    void load()
    const timer = setInterval(() => void load(), 5000)
    return () => { active = false; clearInterval(timer) }
  }, [orderId])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null)
    try {
      const incident = await manejarRespuesta<Incident>(await apiFetch(`/api/orders/${orderId}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, description }) }))
      setRows(prev => [...prev, incident]); setDescription('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la solicitud') }
    finally { setBusy(false) }
  }
  return <section className="bg-white border rounded p-4 mt-4"><h2 className="font-medium mb-3">Cambios y devoluciones</h2>
    {error && <p role="alert" className="text-falla">{error}</p>}
    {rows.map(i => <p key={i.id} className="text-sm py-2 border-b">Solicitud {i.id} · {i.type === 'RETURN' ? 'Devolución' : 'Cambio'} · {i.status} · {i.description}</p>)}
    {refunds.map(r => <p key={r.id} className="text-sm py-2">Reembolso Q {Number(r.amount).toFixed(2)} · {r.status === 'REFUNDED' ? 'Procesado' : r.status === 'FAILED' ? 'Requiere revisión de Finanzas' : 'En proceso'} {r.provider_reference && `· ${r.provider_reference}`}</p>)}
    {canRegister && <form onSubmit={submit} className="space-y-3 mt-3"><label className="block text-sm">Tipo de solicitud<select className="border rounded p-2 w-full" value={type} onChange={e => setType(e.target.value)}><option value="RETURN">Devolución</option><option value="EXCHANGE">Cambio</option></select></label>
      <label className="block text-sm">Motivo<textarea required maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="border rounded p-2 w-full" /></label>
      <Button type="submit" disabled={busy || !description.trim() || refunds.length > 0}>{busy ? 'Registrando…' : 'Registrar solicitud'}</Button>
    </form>}
  </section>
}
