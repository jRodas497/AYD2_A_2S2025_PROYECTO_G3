import { useEffect, useState } from 'react'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { Button } from '../../../shared/components/Button'
import { CreditAssessmentPanel } from '../../credito/CreditAssessmentPanel'
import { httpClientesRepository } from '../clientes/api/clientesRepository.http'
import type { ClienteResumen } from '../clientes/types'

interface History { deliveredOrders: number; purchasedAmount: number; latePayments: number; overduePayments: number; returns: number; confirmedIncidents: number; declinedPayments: number }
interface Snapshot { available: boolean; history: History; fetchedAt: string | null }
const fields: { key: keyof History; label: string }[] = [
  { key: 'deliveredOrders', label: 'Compras entregadas' }, { key: 'purchasedAmount', label: 'Importe neto de compras (Q)' },
  { key: 'latePayments', label: 'Pagos fuera de plazo' }, { key: 'overduePayments', label: 'Saldos actualmente vencidos' },
  { key: 'returns', label: 'Devoluciones confirmadas' }, { key: 'confirmedIncidents', label: 'Otras incidencias confirmadas' },
  { key: 'declinedPayments', label: 'Pagos rechazados' },
]
export function ErpCustomerHistoryPanel() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<ClienteResumen[]>([])
  const [selected, setSelected] = useState<ClienteResumen | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [form, setForm] = useState<History | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void httpClientesRepository.search(query, 20).then(rows => { if (active) setCustomers(rows.filter(c => c.active !== false)) })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudo buscar clientes') })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query])
  async function choose(customer: ClienteResumen) {
    setBusy(true); setSelected(customer); setSnapshot(null); setForm(null); setError(null); setMessage(null)
    try {
      const result = await manejarRespuesta<Snapshot>(await apiFetch(`/api/integration/erp/customers/${customer.id}/history`))
      setSnapshot(result); setForm(result.history)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el historial') }
    finally { setBusy(false) }
  }
  async function save(refresh: boolean) {
    if (!selected || !form || busy) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const path = `/api/integration/erp/customers/${selected.id}/history`
      const result = await manejarRespuesta<Snapshot>(await apiFetch(refresh ? `${path}/refresh` : path, refresh
        ? { method: 'POST' }
        : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }))
      setSnapshot(result); setForm(result.history); setRevision(n => n + 1)
      setMessage(refresh ? 'Historial actualizado desde el ERP.' : 'Historial guardado en el ERP. La evaluación se actualizó automáticamente.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo sincronizar el historial') }
    finally { setBusy(false) }
  }
  return <section className="border rounded p-4 mt-6">
    <h2 className="font-semibold mb-2">Historial de clientes del ERP</h2>
    <p className="text-sm mb-3">Consulta e importa las compras anteriores a SGO-Logic. Las ventas de esta plataforma se incorporan automáticamente a la evaluación y deben excluirse de este historial para evitar duplicarlas.</p>
    <label className="block text-sm">Buscar cliente<input className="border rounded p-2 w-full" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o correo" /></label>
    <div className="flex flex-wrap gap-2 my-3">{customers.map(c => <Button key={c.id} variant="secondary" disabled={busy} onClick={() => void choose(c)}>{c.nombre} · {c.email}</Button>)}</div>
    {error && <p role="alert" className="text-falla my-2">{error}</p>}
    {message && <p role="status" className="text-ok my-2">{message}</p>}
    {selected && <h3 className="font-medium my-3">{selected.nombre}</h3>}
    {snapshot && <p className="text-sm mb-3">{snapshot.available ? 'Historial vigente' : 'ERP no disponible; crédito temporalmente inhabilitado'}{snapshot.fetchedAt && ` · Última consulta: ${new Date(snapshot.fetchedAt).toLocaleString('es-GT')}`}</p>}
    {form && <form onSubmit={e => { e.preventDefault(); void save(false) }}>
      <div className="grid sm:grid-cols-2 gap-3">{fields.map(f => <label key={f.key} className="text-sm">{f.label}<input required type="number" min="0" step={f.key === 'purchasedAmount' ? '0.01' : '1'} disabled={busy} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })} className="border rounded p-2 w-full" /></label>)}</div>
      <div className="flex gap-3 mt-4"><Button type="submit" disabled={busy}>{busy ? 'Sincronizando…' : 'Guardar historial en ERP'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => void save(true)}>Actualizar desde ERP</Button></div>
    </form>}
    {selected && <CreditAssessmentPanel key={selected.id} customerId={selected.id} revision={revision} />}
  </section>
}
