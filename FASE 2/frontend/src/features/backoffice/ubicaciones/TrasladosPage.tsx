import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { useAuth } from '../../../shared/context/AuthContext'
import { hasPermission } from '../../../shared/auth/accessPolicy'
import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import type { Product } from '../../catalogo/types'
import { LOCATION_LABEL, TRANSFER_LABEL, locationRequest, type Location, type Transfer } from './locationApi'
export function TrasladosPage() {
 const { session } = useAuth()
 const central = hasPermission(session?.roles ?? [], 'editTransfers')
 const receive = hasPermission(session?.roles ?? [], 'editInventory')
 const [locations,setLocations] = useState<Location[]>([])
 const [transfers,setTransfers] = useState<Transfer[]>([])
 const [selected,setSelected] = useState<Transfer | null>(null)
 const [status,setStatus] = useState('')
 const [source,setSource] = useState('')
 const [destination,setDestination] = useState('')
 const [reason,setReason] = useState('')
 const [query,setQuery] = useState('')
 const [products,setProducts] = useState<Product[]>([])
 const [items,setItems] = useState<{product:Product; quantity:number}[]>([])
 const [carrier,setCarrier] = useState('')
 const [reference,setReference] = useState('')
 const [driver,setDriver] = useState('')
 const [plate,setPlate] = useState('')
 const [busy,setBusy] = useState(false)
 const [error,setError] = useState('')
 const request = useRef<{key:string; payload:string} | null>(null)
 async function load() { setTransfers(await locationRequest<Transfer[]>(`/api/inventory/transfers${status?`?status=${status}`:''}`)) }
 async function refresh() { await load(); if(selected)setSelected(await locationRequest<Transfer>(`/api/inventory/transfers/${selected.id}`)) }
 useEffect(() => { void locationRequest<Location[]>('/api/inventory/locations').then(setLocations).catch(e=>setError(e.message)) }, [])
 useEffect(() => { let disposed=false;void locationRequest<Transfer[]>(`/api/inventory/transfers${status?`?status=${status}`:''}`).then(rows=>{if(!disposed)setTransfers(rows)}).catch(e=>{if(!disposed)setError(e.message)});return()=>{disposed=true} }, [status])
 async function perform(work:()=>Promise<void>) { if(busy)return;setBusy(true);setError('');try{await work()}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación')}finally{setBusy(false)} }
 async function create(e:React.FormEvent) {
  e.preventDefault()
  await perform(async()=>{
   const payload={sourceId:Number(source),destinationId:Number(destination),reason,items:items.map(i=>({productId:Number(i.product.id),quantity:i.quantity}))}
   const serialized=JSON.stringify(payload)
   if(request.current?.payload!==serialized)request.current={key:crypto.randomUUID(),payload:serialized}
   const transfer=await locationRequest<Transfer>('/api/inventory/transfers','POST',{...payload,requestKey:request.current!.key})
   setSelected(transfer);setItems([]);setReason('');request.current=null;await load()
  })
 }
 async function action(verb:string,body?:unknown) { if(!selected)return;await perform(async()=>{setSelected(await locationRequest<Transfer>(`/api/inventory/transfers/${selected.id}/${verb}`,'POST',body));await load()}) }
 const canReceive=receive && (central || session?.storeId===selected?.destination_id)
 return <div className="space-y-5">
  <h1 className="text-2xl font-semibold">Traslados de mercancía</h1>
  <p>La mercancía queda reservada al crear el traslado, sale del stock al despacharla y se incorpora al destino al confirmar su recepción.</p>
  {error&&<p role="alert" className="text-falla">{error}</p>}
  <div className="flex gap-3"><label>Estado<select className="border p-2 ml-2" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option>{Object.entries(TRANSFER_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><Button variant="secondary" disabled={busy} onClick={()=>void perform(refresh)}>Actualizar traslados</Button></div>
  {central&&<form onSubmit={create} className="border rounded bg-white p-4 space-y-3"><h2 className="font-semibold">Nuevo traslado</h2><div className="grid md:grid-cols-2 gap-3">
   {[{label:'Origen',value:source,set:setSource},{label:'Destino',value:destination,set:setDestination}].map(field=><label key={field.label}>{field.label}<select aria-label={field.label} required className="block border p-2 w-full" value={field.value} onChange={e=>field.set(e.target.value)}><option value="">Selecciona ubicación</option>{locations.map(l=><option key={l.id} value={l.id}>{l.code} · {l.name} ({LOCATION_LABEL[l.type_id]})</option>)}</select></label>)}</div>
   <label className="block">Motivo<input required maxLength={300} className="block border p-2 w-full" value={reason} onChange={e=>setReason(e.target.value)} /></label>
   <div className="flex gap-2"><label className="flex-1">Buscar producto<input className="block border p-2 w-full" value={query} onChange={e=>setQuery(e.target.value)} /></label><Button type="button" variant="secondary" disabled={busy||!query.trim()} onClick={()=>void perform(async()=>setProducts(await httpCatalogRepository.search(query.trim())))}>Buscar productos</Button></div>
   {products.map(p=><button type="button" key={p.id} className="block border p-2 w-full text-left" onClick={()=>{if(!items.some(i=>i.product.id===p.id))setItems([...items,{product:p,quantity:1}]);setProducts([]);setQuery('')}}>{p.nombre} · {p.sku}</button>)}
   {items.map((item,index)=><div key={item.product.id} className="flex gap-3 items-center"><span className="flex-1">{item.product.nombre}</span><label>Cantidad de {item.product.sku}<input required type="number" min={1} max={1000000} className="border p-2 w-24 ml-2" value={item.quantity} onChange={e=>setItems(items.map((i,n)=>n===index?{...i,quantity:Number(e.target.value)}:i))}/></label><Button type="button" variant="secondary" onClick={()=>setItems(items.filter((_,n)=>n!==index))}>Quitar</Button></div>)}
   <Button type="submit" disabled={busy||!items.length||source===destination}>Crear traslado</Button>
  </form>}
  <div className="bg-white border rounded divide-y">{transfers.length===0&&<p className="p-4">No hay traslados en este estado.</p>}{transfers.map(t=><button type="button" key={t.id} className="block w-full text-left p-3 hover:bg-crema" onClick={()=>void perform(async()=>{setSelected(await locationRequest<Transfer>(`/api/inventory/transfers/${t.id}`));setCarrier('');setReference('');setDriver('');setPlate('')})}>Traslado #{t.id} · {t.source_code} → {t.destination_code} · {TRANSFER_LABEL[t.status]}{t.order_id&&` · Orden ${t.order_id}`}{t.last_error&&' · Transporte pendiente de atención'}</button>)}</div>
  {selected&&<section className="border rounded bg-white p-4 space-y-3" aria-label="Detalle del traslado"><h2 className="font-semibold">Traslado #{selected.id} · {TRANSFER_LABEL[selected.status]}</h2><p>{selected.source_code} → {selected.destination_code} · {selected.reason}</p>{selected.order_id&&<Link className="text-brand underline" to={`/administracion/ordenes/${selected.order_id}`}>Orden {selected.order_id}</Link>}
   <ul>{selected.items?.map(i=><li key={i.id}>{i.quantity} × {i.product_name} ({i.sku})</li>)}</ul>
   {selected.transport_reference&&<p>Transportista: {selected.carrier_name} · Referencia: {selected.transport_reference}{selected.driver_name&&` · Conductor: ${selected.driver_name} · Placa: ${selected.vehicle_plate}`}</p>}
   {selected.last_error&&<p role="alert" className="text-falla">{selected.last_error}. Solicita transporte o registra una salida alternativa.</p>}
   {central&&selected.status==='PENDING'&&<><div className="flex gap-2"><Button disabled={busy} onClick={()=>void action('transport')}>Solicitar LogiExpress</Button>{!selected.order_id&&<Button disabled={busy} variant="secondary" onClick={()=>void action('cancel')}>Cancelar traslado</Button>}</div><form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();void action('depart',{carrierName:carrier,reference,driverName:driver,vehiclePlate:plate})}}><label>Transportista alternativo<input required maxLength={120} value={carrier} onChange={e=>setCarrier(e.target.value)} className="block border p-2"/></label><label>Referencia de transporte<input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} className="block border p-2"/></label><label>Conductor<input required maxLength={120} value={driver} onChange={e=>setDriver(e.target.value)} className="block border p-2"/></label><label>Placa del vehículo<input required maxLength={30} value={plate} onChange={e=>setPlate(e.target.value)} className="block border p-2"/></label><Button type="submit" disabled={busy}>Registrar salida</Button></form></>}
   {canReceive&&selected.status==='IN_TRANSIT'&&<Button disabled={busy} onClick={()=>void action('receive')}>Confirmar recepción</Button>}
   <h3 className="font-semibold">Historial</h3><ol>{selected.events?.map((e,i)=><li className="border-t py-2 text-sm" key={i}>{new Date(e.created_at).toLocaleString('es-GT')} · {TRANSFER_LABEL[e.status as keyof typeof TRANSFER_LABEL]??e.status} · {e.detail} · {e.actor}</li>)}</ol>
  </section>}
 </div>
}
