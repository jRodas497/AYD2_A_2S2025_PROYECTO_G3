import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../shared/api/apiFetch'
import { manejarRespuesta } from '../../shared/api/httpErrors'
import type { CreditAccount } from './CreditPage'

interface Assessment extends CreditAccount {
  confirmedIncidents: number; returns: number; pendingIncidents: number
  latePayments: number; overduePayments: number; declinedPayments: number
  criteria: { minimumDeliveredOrders: number; minimumPurchaseAmount: number; maximumConfirmedIncidents: number; maximumReturns: number; maximumLatePayments: number; maximumDeclinedPayments: number }
}
interface Application { id: number; order_id: number; status: string; amount: number; reason: string; created_at: string }

export function CreditAssessmentPanel({ customerId, revision = 0 }: { customerId: string; revision?: number }) {
  const [account, setAccount] = useState<Assessment | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setAccount(null); setApplications([]); setError(null)
    const base = `/api/customers/${customerId}/credit`
    void Promise.all([
      apiFetch(base).then(r => manejarRespuesta<Assessment>(r)),
      apiFetch(`${base}/applications`).then(r => manejarRespuesta<Application[]>(r)),
    ]).then(([a, requests]) => { if (active) { setAccount(a); setApplications(requests) } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudo evaluar el crédito') })
    return () => { active = false }
  }, [customerId, revision])
  return <section className="bg-white border rounded p-4 my-4">
    <h2 className="font-semibold mb-2">Evaluación automática de crédito</h2>
    {error && <p role="alert" className="text-falla">{error}</p>}
    {!account && !error && <p role="status">Consultando historial…</p>}
    {account && <>
      <p>{account.eligible ? 'Crédito habilitado' : 'Crédito no habilitado'} · {account.reason}</p>
      <p className="text-sm mt-2">Compras entregadas: {account.deliveredOrders} · Importe: Q {Number(account.purchasedAmount ?? 0).toFixed(2)} · Disponible: Q {Number(account.available).toFixed(2)}</p>
      <p className="text-sm mt-2">Pagos atrasados: {account.latePayments} · Saldos vencidos: {account.overduePayments} · Rechazos: {account.declinedPayments}</p>
      <p className="text-sm mt-2">Incidencias confirmadas: {account.confirmedIncidents} · Devoluciones: {account.returns} · En revisión: {account.pendingIncidents}</p>
      <p className="text-sm mt-2">Historial ERP {account.erpAvailable ? 'vigente' : 'no disponible'}. Plazo: {account.termDays} días.</p>
      <details className="text-sm mt-3"><summary>Criterios vigentes</summary>
        <p>Mínimo: {account.criteria.minimumDeliveredOrders} compras y Q {Number(account.criteria.minimumPurchaseAmount).toFixed(2)}.</p>
        <p>Máximos permitidos: {account.criteria.maximumConfirmedIncidents} incidencias, {account.criteria.maximumReturns} devoluciones, {account.criteria.maximumLatePayments} pagos atrasados y {account.criteria.maximumDeclinedPayments} rechazos. Los saldos vencidos y las solicitudes en revisión impiden nuevas compras a crédito.</p>
      </details>
    </>}
    {applications.length > 0 && <details className="mt-3 text-sm"><summary>Solicitudes anteriores ({applications.length})</summary>
      {applications.map(a => <p key={a.id} className="border-b py-2"><Link className="text-brand" to={`/administracion/ordenes/${a.order_id}`}>Orden {a.order_id}</Link> · {a.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'} · Q {Number(a.amount).toFixed(2)} · {a.reason} · {new Date(a.created_at).toLocaleString('es-GT')}</p>)}
    </details>}
  </section>
}
