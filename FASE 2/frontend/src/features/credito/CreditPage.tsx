import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useCustomer } from '../../shared/context/CustomerContext'
import { apiFetch } from '../../shared/api/apiFetch'
import { manejarRespuesta } from '../../shared/api/httpErrors'
import { Button } from '../../shared/components/Button'
export interface CreditAccount { eligible: boolean; limit: number; used: number; available: number; termDays: number; reason: string; deliveredOrders: number; purchasedAmount?:number; erpAvailable?:boolean }
interface Application { id:number;order_id:number;status:string;reason:string;amount:number;created_at:string }
interface Charge { id: number; order_id: number; amount: number; due_at: string; paid_at: string | null; voided_at: string | null; repayment_reference: string | null; repayment_error: string | null; overdue: boolean; return_pending: boolean }
export function CreditPage() {
  const { customer } = useCustomer()
  const [account, setAccount] = useState<CreditAccount | null>(null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [card, setCard] = useState('')
  const [cvv, setCvv] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [applications,setApplications]=useState<Application[]>([])
  async function load() {
    if (!customer) return
    try {
      const base = `/api/customers/${customer.id}/credit`
      const [a, c] = await Promise.all([manejarRespuesta<CreditAccount>(await apiFetch(base)), manejarRespuesta<Charge[]>(await apiFetch(`${base}/charges`))])
      setAccount(a); setCharges(c); setError(null)
      setApplications(await manejarRespuesta<Application[]>(await apiFetch(`${base}/applications`)))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el crédito') }
  }
  useEffect(() => { void load(); const timer=setInterval(() => void load(),5000); return () => clearInterval(timer) }, [customer?.id])
  if (!customer) return <Navigate to="/ingresar" replace />
  async function repay(id: number) {
    if (!customer || pending !== null) return
    const digits=card.replace(/\D/g,'')
    if(digits.length!==16 || !/^\d{3,4}$/.test(cvv)) { setError('Ingresa una tarjeta de 16 dígitos y un CVV válido.'); return }
    const cardToken=`tok_credit_${digits.slice(-4)}_${crypto.randomUUID()}`
    setCard(''); setCvv(''); setMessage(null)
    setPending(id)
    try {
      const result=await manejarRespuesta<{ paid: boolean; queued?: boolean }>(await apiFetch(`/api/customers/${customer.id}/credit/charges/${id}/repay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardToken }) }))
      await load(); setMessage(result.paid ? 'Abono registrado.' : 'Abono en proceso. Se confirmará automáticamente cuando PayKlik esté disponible.')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el pago') }
    finally { setPending(null) }
  }
  return <div>
    <h1 className="text-2xl font-semibold mb-4">Mi crédito</h1>
    {error && <p role="alert" className="text-falla mb-4">{error}</p>}
    {account && <div className="bg-white border rounded p-4 mb-4">
      <p className="font-medium">{account.eligible ? 'Crédito habilitado' : 'Crédito aún no habilitado'}</p>
      <p className="text-sm my-2">{account.reason}</p>
      <p>Límite: Q {Number(account.limit).toFixed(2)} · Usado: Q {Number(account.used).toFixed(2)} · Disponible: Q {Number(account.available).toFixed(2)}</p>
      <p className="text-sm mt-2">Plazo de pago: {account.termDays} días. Compras entregadas: {account.deliveredOrders}.</p>
      <p className="text-sm mt-2">Importe de compras entregadas: Q {Number(account.purchasedAmount??0).toFixed(2)} · Historial ERP: {account.erpAvailable?'vigente':'no disponible'}.</p>
    </div>}
    {message && <p role="status" className="text-ok mb-3">{message}</p>}
    {charges.some(c => !c.paid_at && !c.voided_at && !c.return_pending) && <div className="bg-white border rounded p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-sm">Número de tarjeta<input inputMode="numeric" autoComplete="off" value={card} onChange={e => setCard(e.target.value)} placeholder="0000 0000 0000 0000" className="border rounded p-2 w-full" /></label>
      <label className="text-sm">CVV<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={cvv} onChange={e => setCvv(e.target.value)} className="border rounded p-2 w-full" /></label>
    </div>}
    {charges.length === 0 && <p className="text-gray-500">No tienes compras a crédito.</p>}
    {applications.length>0&&<section className="border rounded p-4 mb-4"><h2 className="font-semibold">Solicitudes de crédito</h2>{applications.map(a=><p key={a.id} className="border-b py-2 text-sm"><Link to={`/ordenes/${a.order_id}`} className="text-brand">Orden {a.order_id}</Link> · {a.status==='APPROVED'?'Aprobada':'Rechazada'} · Q {Number(a.amount).toFixed(2)} · {a.reason}</p>)}</section>}
    {charges.map(c => <div key={c.id} className="bg-white border rounded p-4 mb-3 flex flex-wrap gap-4 items-center">
      <Link to={`/ordenes/${c.order_id}`} className="text-brand">Orden {c.order_id}</Link>
      <span>Q {Number(c.amount).toFixed(2)}</span>
      <span>Vence: {new Date(c.due_at).toLocaleDateString('es-GT')}</span>
      <span className={c.overdue ? 'text-falla' : 'text-ok'}>{c.voided_at ? 'Anulado por devolución' : c.paid_at ? 'Pagado' : c.return_pending ? 'Devolución en proceso' : c.repayment_reference === 'PENDING' ? 'Abono en proceso' : c.overdue ? 'Vencido' : 'Pendiente'}</span>
      {c.repayment_error&&c.repayment_reference==='PENDING'&&!c.paid_at&&!c.voided_at&&<><span role="alert" className="text-falla">El abono requiere un reintento.</span><Button disabled={pending!==null} onClick={async()=>{
        setPending(c.id);setError(null)
        try{await manejarRespuesta(await apiFetch(`/api/customers/${customer.id}/credit/charges/${c.id}/retry`,{method:'POST'}));await load();setMessage('Reintento encolado. Se usará el mismo abono, sin duplicar el cobro.')}
        catch(e){setError(e instanceof Error?e.message:'No se pudo reintentar')}finally{setPending(null)}
      }}>Reintentar abono</Button></>}
      {c.repayment_error&&c.repayment_reference!=='PENDING'&&!c.paid_at&&!c.voided_at&&<span role="alert" className="text-falla">Abono rechazado: {c.repayment_error}. Puedes usar otra tarjeta.</span>}
      {!c.paid_at && !c.voided_at && !c.return_pending && <Button disabled={pending !== null || !card.trim() || !cvv || c.repayment_reference === 'PENDING'} onClick={() => void repay(c.id)}>{pending === c.id ? 'Procesando…' : 'Pagar saldo'}</Button>}
    </div>)}
  </div>
}
