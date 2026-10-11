import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { locationRequest, TRANSFER_LABEL, type Transfer } from '../backoffice/ubicaciones/locationApi'
export function OrderTransfers({orderId,staff}:{orderId:string;staff:boolean}) {
 const [transfers,setTransfers]=useState<Transfer[]>([])
 const [error,setError]=useState('')
 useEffect(()=>{
  let stopped=false
  const load=async()=>{try{const result=await locationRequest<Transfer[]>(`/api/orders/${orderId}/transfers`);if(!stopped){setTransfers(result);setError('')}}catch(e){if(!stopped)setError(e instanceof Error?e.message:'No se pudo consultar la consolidación')}}
  void load();const timer=setInterval(()=>void load(),5000);return()=>{stopped=true;clearInterval(timer)}
 },[orderId])
 if(!transfers.length&&!error)return null
 return <section className="bg-white border rounded p-4 mb-4"><h2 className="font-semibold mb-2">Preparación de mercancía</h2><p className="text-sm mb-2">Los productos se reúnen en el punto de despacho antes de preparar tu envío.</p>{error&&<p role="alert">{error}</p>}{transfers.map(t=><p className="text-sm py-1" key={t.id}>{t.source_code} → {t.destination_code}: {TRANSFER_LABEL[t.status]}{t.last_error&&' · Logística está gestionando el transporte'}</p>)}{staff&&<Link className="text-brand underline" to="/administracion/traslados">Gestionar traslados</Link>}</section>
}
