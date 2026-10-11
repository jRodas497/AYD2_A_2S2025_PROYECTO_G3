import { useEffect, useState } from 'react'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { useAuth } from '../../../shared/context/AuthContext'
import { Button } from '../../../shared/components/Button'
interface Product { id: number; sku: string; name: string; category: string; price: number; originalPrice?: number; active: boolean }
interface Promotion { id: number; nombre: string; descuentoPorcentaje: number }
export function CatalogAdminPage() {
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('ELECTRONICA')
  const [promoName, setPromoName] = useState('')
  const [discount, setDiscount] = useState('10')
  const [days, setDays] = useState('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function load() {
    try {
      const [p, promos] = await Promise.all([apiFetch('/api/products?includeInactive=true').then(r => manejarRespuesta<Product[]>(r)), apiFetch('/api/promotions').then(r => manejarRespuesta<Promotion[]>(r))])
      setProducts(p); setPromotions(promos)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo') }
  }
  useEffect(() => { void load() }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null)
    try {
      await manejarRespuesta(await apiFetch(editing ? `/api/products/${editing}` : '/api/products', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku, name, category, price: Number(price), active: true }) }))
      setEditing(null); setName(''); setSku(''); setPrice(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el producto') }
    finally { setBusy(false) }
  }
  async function promote(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null)
    try {
      await manejarRespuesta(await apiFetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: promoName, description: `Descuento del ${discount}%`, category, discountPercent: Number(discount), endsAt: new Date(Date.now() + Number(days) * 86400000).toISOString() }) }))
      setPromoName(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la promoción') }
    finally { setBusy(false) }
  }
  async function deactivate(product: Product) {
    if (busy) return; setBusy(true)
    try { await manejarRespuesta(await apiFetch(`/api/products/${product.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...product, price: product.originalPrice ?? product.price, active: !product.active }) })); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar') }
    finally { setBusy(false) }
  }
  async function endPromotion(id: number) {
    setBusy(true)
    try { await manejarRespuesta(await apiFetch(`/api/promotions/${id}/active`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) })); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo finalizar la promoción') }
    finally { setBusy(false) }
  }
  return <div><h1 className="text-2xl font-semibold mb-4">Catálogo y promociones</h1>
    {error && <p className="text-falla" role="alert">{error}</p>}
    {isAdmin && <form onSubmit={save} className="bg-white border rounded p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <h2 className="sm:col-span-2 font-medium">{editing ? 'Editar producto' : 'Crear producto'}</h2>
      <label className="text-sm">SKU<input required disabled={editing !== null} value={sku} onChange={e => setSku(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="text-sm">Nombre<input required value={name} onChange={e => setName(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="text-sm">Precio Q<input required type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="text-sm">Categoría<select value={category} onChange={e => setCategory(e.target.value)} className="border rounded p-2 w-full">{['LINEA_BLANCA','ELECTRONICA','ROPA','CALZADO'].map(c => <option key={c}>{c}</option>)}</select></label>
      <Button disabled={busy} type="submit">Guardar producto</Button><button type="button" onClick={() => { setEditing(null); setName(''); setSku(''); setPrice('') }}>Limpiar</button>
    </form>}
    <div className="bg-white border rounded mb-4">{products.map(p => <div key={p.id} className="p-3 border-b flex flex-wrap items-center gap-3 text-sm"><span className="flex-1">{p.sku} · {p.name} · Q {Number(p.originalPrice ?? p.price).toFixed(2)} · {p.active ? 'Activo' : 'Inactivo'}</span>
      {isAdmin && <><button disabled={busy} className="text-brand" onClick={() => { setEditing(p.id); setSku(p.sku); setName(p.name); setPrice(String(p.originalPrice ?? p.price)); setCategory(p.category) }}>Editar</button><button disabled={busy} className="text-brand" onClick={() => void deactivate(p)}>{p.active ? 'Desactivar' : 'Activar'}</button></>}
    </div>)}</div>
    {isAdmin && <form onSubmit={promote} className="bg-white border rounded p-4 mb-4 space-y-3"><h2 className="font-medium">Crear promoción para {category}</h2>
      <label className="block text-sm">Nombre de promoción<input required value={promoName} onChange={e => setPromoName(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="block text-sm">Descuento %<input required type="number" min="0.01" max="99.99" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="block text-sm">Vigencia en días<input required type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} className="border rounded p-2 w-full" /></label>
      <Button type="submit" disabled={busy}>Crear promoción</Button>
    </form>}
    {promotions.map(p => <div key={p.id} className="bg-white border rounded p-3 mb-2 text-sm flex justify-between"><span>{p.nombre} · {p.descuentoPorcentaje}%</span>{isAdmin && <button className="text-brand" disabled={busy} onClick={() => void endPromotion(p.id)}>Finalizar</button>}</div>)}
  </div>
}
