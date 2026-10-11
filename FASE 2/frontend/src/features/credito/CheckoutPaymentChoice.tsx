import { useEffect, useState } from 'react'
import { apiFetch } from '../../shared/api/apiFetch'
import { manejarRespuesta } from '../../shared/api/httpErrors'
import type { CreditAccount } from './CreditPage'

export function CheckoutPaymentChoice({ customerId,total,value,onChange }: { customerId:string;total:number;value:'CARD'|'CREDIT';onChange:(value:'CARD'|'CREDIT')=>void }) {
  const [account,setAccount]=useState<CreditAccount|null>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let cancelled=false
    async function refresh(){
      try{const next=await manejarRespuesta<CreditAccount>(await apiFetch(`/api/customers/${customerId}/credit`));if(!cancelled)setAccount(next)}
      catch{if(!cancelled)setAccount(null)}finally{if(!cancelled)setLoading(false)}
    }
    void refresh();const timer=setInterval(()=>void refresh(),10000)
    return()=>{cancelled=true;clearInterval(timer)}
  },[customerId])
  const enabled=!!account?.eligible&&Number(account.available)>=total
  useEffect(()=>{if(!loading&&!enabled&&value==='CREDIT')onChange('CARD')},[loading,enabled,value,onChange])
  return <fieldset className="border rounded p-4 mb-4 space-y-2">
    <legend className="font-medium">Cómo pagarás</legend>
    <label className="flex gap-2"><input type="radio" name="checkout-payment" checked={value==='CARD'} onChange={()=>onChange('CARD')}/>PayKlik · tarjeta y otros medios de pago</label>
    {enabled&&<label className="flex gap-2"><input type="radio" name="checkout-payment" checked={value==='CREDIT'} onChange={()=>onChange('CREDIT')}/>Crédito MegaStore · paga en {account!.termDays} días</label>}
    <p className="text-sm text-gray-500">{loading?'Consultando elegibilidad. Puedes continuar con PayKlik.':!account?'No se pudo consultar el crédito. Puedes continuar con PayKlik.':!account.eligible?account.reason:Number(account.available)<total?'El crédito disponible no cubre esta compra.':`Crédito disponible: Q ${Number(account.available).toFixed(2)}. La aprobación se confirma al pagar.`}</p>
  </fieldset>
}
