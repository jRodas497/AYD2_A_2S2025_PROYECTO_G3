import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { locationRequest } from '../ubicaciones/locationApi'
export function ManualTransportForm({shipmentId,onSaved}:{shipmentId:number;onSaved:()=>Promise<void>}){
 const [form,setForm]=useState({carrierName:'',driverName:'',vehiclePlate:'',reference:'',reason:''})
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const fields=[['carrierName','Transportista',120],['driverName','Conductor',120],['vehiclePlate','Placa del vehículo',30],['reference','Referencia o guía',100],['reason','Motivo de asignación',300]] as const
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await locationRequest(`/api/shipments/${shipmentId}/transport`,'POST',form);await onSaved()}catch(e){setError(e instanceof Error?e.message:'No se pudo asignar el transporte')}finally{setBusy(false)}}
 return <form onSubmit={save} className="bg-white border rounded p-4 space-y-3"><h3 className="font-semibold">Asignar transporte alternativo</h3><p className="text-sm">Registra el transporte disponible para completar la entrega.</p>{error&&<p role="alert" className="text-falla">{error}</p>}<div className="grid md:grid-cols-2 gap-3">{fields.map(([key,label,max])=><label key={key}>{label}<input required maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="block border rounded p-2 w-full"/></label>)}</div><Button disabled={busy} type="submit">{busy?'Asignando…':'Asignar transporte'}</Button></form>
}
