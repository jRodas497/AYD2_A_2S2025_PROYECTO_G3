import { useEffect, useState } from 'react'
import { apiFetch, downloadFile } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { Button } from '../../../shared/components/Button'
import { ErpCustomerHistoryPanel } from './ErpCustomerHistoryPanel'
interface Batch { id: number; file_name: string; status: string; order_count: number; total_amount: number; created_at: string; attempts: number; last_error: string | null }
interface Sale { orderId: number; customer: string; total: number; invoiceCui: string; channel: string }
export function ErpPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    try { setBatches(await manejarRespuesta<Batch[]>(await apiFetch('/api/integration/erp/batches?limit=100'))); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el ERP') }
  }
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 5000); return () => clearInterval(timer) }, [])
  async function action(path: string) {
    if (busy) return
    setBusy(true)
    try { await manejarRespuesta(await apiFetch(path, { method: 'POST' })); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar el lote') }
    finally { setBusy(false) }
  }
  async function detail(id: number) {
    try { const result = await manejarRespuesta<{ orders: Sale[] }>(await apiFetch(`/api/integration/erp/batches/${id}`)); setSales(result.orders); setSelected(id) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el lote') }
  }
  return <div>
    <h1 className="text-2xl font-semibold mb-2">Conciliación ERP AS/400</h1>
    <p className="text-sm mb-4 text-gray-500">Los lotes se generan automáticamente cada 30 minutos, según Configuración. Cada venta se incluye una sola vez.</p>
    {error && <p className="text-falla mb-4" role="alert">{error}</p>}
    <Button disabled={busy} onClick={() => void action('/api/integration/erp/batches')}>{busy ? 'Procesando…' : 'Generar lote ahora'}</Button>
    {batches.length === 0 && <p className="mt-4">Todavía no hay lotes de ventas.</p>}
    <div className="overflow-x-auto mt-4"><table className="w-full text-sm"><thead><tr><th>Lote</th><th>Estado</th><th>Órdenes</th><th>Total</th><th>Acciones</th></tr></thead><tbody>
      {batches.map(b => <tr key={b.id} className="border-b"><td className="py-3">{b.id}</td><td title={b.last_error ?? undefined}>{b.status} · {b.attempts} intentos{b.last_error && <p className="text-xs text-falla">{b.last_error}</p>}</td><td>{b.order_count}</td><td>Q {Number(b.total_amount).toFixed(2)}</td><td className="space-x-3">
        <button className="text-brand" onClick={() => void detail(b.id)}>Detalle</button>
        <button className="text-brand" onClick={() => void downloadFile(`/api/integration/erp/batches/${b.id}/file`, b.file_name).catch(e => setError(e.message))}>Descargar</button>
        {b.status === 'FAILED' && <button disabled={busy} className="text-brand" onClick={() => void action(`/api/integration/erp/batches/${b.id}/retry`)}>Reintentar</button>}
      </td></tr>)}
    </tbody></table></div>
    {selected !== null && <div className="bg-white border rounded p-4 mt-4"><h2 className="font-medium mb-3">Ventas del lote {selected}</h2>
      {sales.map(s => <p key={s.orderId} className="text-sm py-2 border-b">{s.orderId < 0 ? 'Ajuste de devolución' : 'Orden'} {Math.abs(s.orderId)} · {s.customer} · {s.channel} · Q {Number(s.total).toFixed(2)} · {s.invoiceCui}</p>)}
    </div>}
    <ErpCustomerHistoryPanel />
  </div>
}
