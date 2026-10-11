import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import { httpCartRepository } from '../../carrito/api/cartRepository.http'
import type { Cart } from '../../carrito/types'
import type { Product } from '../../catalogo/types'
import { CheckoutPaymentChoice } from '../../credito/CheckoutPaymentChoice'

interface Client { id: number; fullName: string; email: string; address: string | null; active: boolean }
interface Location { id: number; code: string; name: string; type_id: number }
export function VentaAsistidaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [clients,setClients]=useState<Client[]>([])
  const [client,setClient]=useState<Client|null>(null)
  const [query,setQuery]=useState('')
  const [products,setProducts]=useState<Product[]>([])
  const [productQuery,setProductQuery]=useState('')
  const [cart,setCart]=useState<Cart>({items:[]})
  const [address,setAddress]=useState('')
  const [pickup,setPickup]=useState('')
  const [locations,setLocations]=useState<Location[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [create,setCreate]=useState(false)
  const [newClient,setNewClient]=useState({fullName:'',email:'',phone:'',address:''})
  const [paymentMethod,setPaymentMethod]=useState<'CARD'|'CREDIT'>('CARD')
  async function select(c:Client) {
    if(!c.active) {setError('El cliente está desactivado.');return}
    setClient(c);setPaymentMethod('CARD');setAddress(c.address??'');setPickup('');setError('');setCart(await httpCartRepository.getCart(String(c.id)))
  }
  async function run(action:()=>Promise<void>) {
    if(busy)return;setBusy(true);setError('')
    try {await action()} catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación')} finally{setBusy(false)}
  }
  useEffect(()=>{
    let cancelled=false
    async function load() {
      setBusy(true);setError('');setClient(null);setCart({items:[]})
      try {
        const available=await manejarRespuesta<Location[]>(await apiFetch('/api/inventory/locations'))
        const selected=id?await manejarRespuesta<Client>(await apiFetch(`/api/customers/${id}`)):null
        if(selected&&!selected.active)throw new Error('El cliente está desactivado.')
        const shared=selected?await httpCartRepository.getCart(String(selected.id)):{items:[]}
        if(cancelled)return
        setLocations(available);setClient(selected);setAddress(selected?.address??'');setPickup('');setCart(shared)
      } catch(e){if(!cancelled)setError(e instanceof Error?e.message:'No se pudo cargar la venta asistida')}
      finally {if(!cancelled)setBusy(false)}
    }
    void load()
    return()=>{cancelled=true}
  },[id])
  async function change(productId:string,quantity?:number) {
    if(!client)return
    const base=`/api/customers/${client.id}/cart/items`
    await manejarRespuesta(await apiFetch(quantity?base:`${base}/${productId}?channel=CALL_CENTER`,{method:quantity?'POST':'DELETE',headers:{'Content-Type':'application/json'},...(quantity?{body:JSON.stringify({productId:Number(productId),quantity,channel:'CALL_CENTER'})}:{})}))
    setCart(await httpCartRepository.getCart(String(client.id)))
  }
  return <div className="max-w-3xl space-y-4">
    <h1 className="text-2xl font-semibold">Venta asistida</h1>
    <p>Continúa el carrito del cliente por teléfono. La orden queda registrada en el canal CALL_CENTER.</p>
    {error&&<p role="alert" className="text-falla">{error}</p>}
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>setClients(await manejarRespuesta<Client[]>(await apiFetch(`/api/customers?q=${encodeURIComponent(query)}&limit=50`))))}}>
      <label>Buscar cliente<input className="border rounded p-2 block" value={query} onChange={e=>setQuery(e.target.value)}/></label><button disabled={busy}>Buscar cliente</button>
      <button type="button" onClick={()=>setCreate(!create)}>Crear cliente</button>
    </form>
    {create&&<form className="border rounded p-4 space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>{const c=await manejarRespuesta<Client>(await apiFetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newClient)}));await select(c);setCreate(false)})}}>
      {(['fullName','email','phone','address'] as const).map((k,i)=><label className="block" key={k}>{['Nombre del cliente','Correo del cliente','Teléfono del cliente','Dirección del cliente'][i]}<input className="border rounded p-2 block w-full" required={k==='fullName'} type={k==='email'?'email':'text'} value={newClient[k]} onChange={e=>setNewClient({...newClient,[k]:e.target.value})}/></label>)}
      <button disabled={busy}>Guardar cliente</button>
    </form>}
    <div className="flex flex-wrap gap-2">{clients.map(c=><button key={c.id} disabled={busy||!c.active} className="border rounded p-2" onClick={()=>void run(()=>select(c))}>{c.fullName} · {c.email}</button>)}</div>
    {client&&<>
      <h2 className="font-semibold">Cliente seleccionado: {client.fullName}</h2>
      <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>setProducts(await httpCatalogRepository.search(productQuery)))}}>
        <label>Buscar producto<input className="border rounded p-2 block" value={productQuery} onChange={e=>setProductQuery(e.target.value)}/></label><button disabled={busy}>Buscar producto</button>
      </form>
      {products.map(p=><div className="flex justify-between border rounded p-3" key={p.id}><span>{p.nombre} · Q {p.precio.final.toFixed(2)}</span><button disabled={busy} onClick={()=>void run(()=>change(p.id,1))}>Agregar {p.sku}</button></div>)}
      <h2 className="font-semibold">Carrito compartido</h2>
      {cart.items.length===0?<p>Carrito vacío</p>:cart.items.map(item=><div key={item.productId} className="flex gap-4 border rounded p-3"><span>{item.nombre} · {item.cantidad} · Q {(item.precioUnitario*item.cantidad).toFixed(2)}</span><button disabled={busy} onClick={()=>void run(()=>change(item.productId,1))}>Sumar unidad</button><button disabled={busy} onClick={()=>void run(()=>change(item.productId))}>Quitar producto</button></div>)}
      <CheckoutPaymentChoice key={client.id} customerId={String(client.id)} total={cart.items.reduce((sum,item)=>sum+item.precioUnitario*item.cantidad,0)} value={paymentMethod} onChange={setPaymentMethod}/>
      <form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>{const order=await manejarRespuesta<{id:number}>(await apiFetch('/api/orders/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:client.id,deliveryAddress:pickup?'Retiro en tienda':address,pickupLocationId:pickup?Number(pickup):null,channel:'CALL_CENTER',paymentMethod})}));navigate(`/administracion/ordenes/${order.id}/pago`)})}}>
        <label className="block">Entrega<select className="border rounded p-2 block" value={pickup} onChange={e=>setPickup(e.target.value)}><option value="">Envío a domicilio</option>{locations.filter(l=>l.type_id===2).map(l=><option key={l.id} value={l.id}>Retiro {l.code} · {l.name}</option>)}</select></label>
        {!pickup&&<label className="block">Dirección de entrega<input required className="border rounded p-2 block w-full" value={address} onChange={e=>setAddress(e.target.value)}/></label>}
        <button disabled={busy||cart.items.length===0} className="bg-brand text-white rounded px-4 py-2">Crear orden y continuar al pago</button>
      </form>
    </>}
  </div>
}
