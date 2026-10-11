import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pill } from '../../../../shared/components/Pill'
import { useAuth } from '../../../../shared/context/AuthContext'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpIncidenciasRepository } from '../api/incidenciasRepository.http'
import type { IncidenciaGlobal } from '../types'
import { apiFetch } from '../../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { httpCatalogRepository } from '../../../catalogo/api/catalogRepository.http'
import type { Product } from '../../../catalogo/types'

const TONO_ESTADO: Record<IncidenciaGlobal['estado'], 'ok' | 'alerta' | 'falla' | 'info'> = {
  REGISTERED: 'alerta',
  IN_PROCESS: 'info',
  RESOLVED: 'ok',
  REJECTED: 'falla',
}

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Bandeja de incidencias: cambios y devoluciones comparten la misma pantalla, filtradas por tipo. */
export function IncidentInbox({ tipoFijo, titulo, descripcion }: { tipoFijo?: 'EXCHANGE' | 'RETURN'; titulo: string; descripcion: string }) {
  const [estado, setEstado] = useState('')
  const [incidencias, setIncidencias] = useState<IncidenciaGlobal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<number | null>(null)
  const [exchange,setExchange]=useState<number|null>(null)
  const [query,setQuery]=useState('')
  const [products,setProducts]=useState<Product[]>([])
  const [product,setProduct]=useState('')
  const [quantity,setQuantity]=useState(1)
  const { session } = useAuth()
  const isAdmin = session?.roles.some(r => ['ADMIN', 'FINANCE', 'CALL_CENTER_AGENT', 'STORE_EMPLOYEE', 'STORE_MANAGER'].includes(r)) ?? false
  const { notificar } = useNotify()

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setIncidencias(await httpIncidenciasRepository.search({ status: estado || undefined, type: tipoFijo, limit: 100 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las incidencias')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  async function procesar(id: number, status: 'IN_PROCESS' | 'RESOLVED' | 'REJECTED') {
    setProcesando(id)
    try {
      await httpIncidenciasRepository.updateStatus(id, status)
      notificar('Incidencia actualizada.', 'ok')
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo actualizar la incidencia', 'falla')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">{titulo}</h1>
      <p className="text-sm text-gray-500 mb-1">{descripcion}</p>
      {!isAdmin && (
        <p className="text-xs text-alerta mb-4">
          Inicia sesión de personal para poder procesarlas (ver Iniciar sesión en la barra superior).
        </p>
      )}

      <div className="flex gap-2 mb-4 mt-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-linea rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="REGISTERED">Registradas</option>
          <option value="IN_PROCESS">En proceso</option>
          <option value="RESOLVED">Resueltas</option>
          <option value="REJECTED">Rechazadas</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : incidencias.length === 0 ? (
        <p className="text-sm text-gray-400">Sin incidencias con esos filtros.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {incidencias.map((i) => (
            <div key={i.id} className="p-3">
              <div className="flex items-center justify-between gap-3 text-sm mb-1">
                <Link to={`/administracion/ordenes/${i.orderId}`} className="font-medium text-brand hover:underline">
                  Orden {i.orderId}
                </Link>
                <span className="text-gray-500">{i.cliente}</span>
                <span className="text-xs text-gray-400">{formatFecha(i.creadaEn)}</span>
                <span>{formatQ(i.totalOrden)}</span>
                <Pill tone={TONO_ESTADO[i.estado]}>{i.estado}</Pill>
              </div>
              <p className="text-sm text-gray-600 mb-2">{i.descripcion}</p>
              {i.replacementOrderId&&<Link to={`/administracion/ordenes/${i.replacementOrderId}`} className="text-brand">Orden de reemplazo {i.replacementOrderId}</Link>}
              {isAdmin && i.estado !== 'RESOLVED' && i.estado !== 'REJECTED' && (
                <div className="flex gap-2">
                  {i.estado === 'REGISTERED' && (
                    <button
                      disabled={procesando === i.id}
                      onClick={() => procesar(i.id, 'IN_PROCESS')}
                      className="text-xs text-brand hover:underline"
                    >
                      Marcar en proceso
                    </button>
                  )}
                  <button
                    disabled={procesando === i.id}
                    onClick={() => i.tipo==='EXCHANGE'?setExchange(i.id):procesar(i.id, 'RESOLVED')}
                    className="text-xs text-ok hover:underline"
                  >
                    {i.tipo==='EXCHANGE'?'Seleccionar reemplazo':'Resolver'}
                  </button>
                  <button
                    disabled={procesando === i.id}
                    onClick={() => procesar(i.id, 'REJECTED')}
                    className="text-xs text-falla hover:underline"
                  >
                    Rechazar
                  </button>
                </div>
              )}
              {exchange===i.id&&<div className="border rounded p-3 mt-3 space-y-3">
                <p>Se devolverá la orden completa y se creará una nueva orden vinculada para pagar el reemplazo. El reembolso de la compra original se procesa por separado.</p>
                <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();try{setProducts(await httpCatalogRepository.search(query));setProduct('')}catch(e){notificar(e instanceof Error?e.message:'No se pudo buscar','falla')}}}>
                  <label>Buscar reemplazo<input className="border rounded p-2 block" value={query} onChange={e=>setQuery(e.target.value)}/></label><button>Buscar</button>
                </form>
                <label className="block">Producto de reemplazo<select className="border rounded p-2 block w-full" value={product} onChange={e=>setProduct(e.target.value)}><option value="">Selecciona un producto</option>{products.map(p=><option value={p.id} key={p.id}>{p.nombre} · Q {p.precio.final.toFixed(2)}</option>)}</select></label>
                <label className="block">Cantidad de reemplazo<input type="number" min={1} max={100000} className="border rounded p-2 block" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
                <button disabled={!product||quantity<1||procesando!==null} onClick={async()=>{
                  setProcesando(i.id)
                  try{await manejarRespuesta(await apiFetch(`/api/incidents/${i.id}/exchange`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:Number(product),quantity})}));setExchange(null);await cargar();notificar('Cambio registrado y orden de reemplazo creada.','ok')}
                  catch(e){notificar(e instanceof Error?e.message:'No se pudo procesar el cambio','falla')}finally{setProcesando(null)}
                }}>Confirmar cambio y crear orden</button>
                <button onClick={()=>setExchange(null)}>Cancelar</button>
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
