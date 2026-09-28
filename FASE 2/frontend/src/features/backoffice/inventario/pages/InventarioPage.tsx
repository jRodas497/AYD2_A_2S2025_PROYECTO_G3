import { useState } from 'react'
import { Button } from '../../../../shared/components/Button'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpCatalogRepository } from '../../../catalogo/api/catalogRepository.http'
import { httpInventoryOpsRepository } from '../api/inventoryOpsRepository.http'
import type { Product } from '../../../catalogo/types'
import type { Availability, StockMovement } from '../types'

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function InventarioPage() {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Product[]>([])
  const [buscando, setBuscando] = useState(false)
  const [producto, setProducto] = useState<Product | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<Availability | null>(null)
  const [movimientos, setMovimientos] = useState<StockMovement[]>([])
  const [locationCode, setLocationCode] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [tipo, setTipo] = useState<'IN' | 'OUT'>('IN')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { notificar } = useNotify()

  async function buscar() {
    if (!query.trim()) return
    setBuscando(true)
    try {
      setResultados(await httpCatalogRepository.search(query.trim()))
    } finally {
      setBuscando(false)
    }
  }

  async function seleccionar(p: Product) {
    setProducto(p)
    setResultados([])
    setQuery('')
    const [disp, movs] = await Promise.all([
      httpInventoryOpsRepository.availability(Number(p.id)),
      httpInventoryOpsRepository.movements(Number(p.id), 20),
    ])
    setDisponibilidad(disp)
    setMovimientos(movs)
  }

  async function recargar() {
    if (!producto) return
    const [disp, movs] = await Promise.all([
      httpInventoryOpsRepository.availability(Number(producto.id)),
      httpInventoryOpsRepository.movements(Number(producto.id), 20),
    ])
    setDisponibilidad(disp)
    setMovimientos(movs)
  }

  async function registrarMovimiento(e: React.FormEvent) {
    e.preventDefault()
    if (!producto || !locationCode.trim() || !cantidad.trim() || !motivo.trim()) return
    setEnviando(true)
    try {
      await httpInventoryOpsRepository.registerMovement({
        locationCode: locationCode.trim().toUpperCase(),
        productId: Number(producto.id),
        type: tipo,
        quantity: Number(cantidad),
        reason: motivo.trim(),
      })
      notificar('Movimiento registrado.', 'ok')
      setCantidad('')
      setMotivo('')
      await recargar()
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'No se pudo registrar el movimiento', 'falla')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Inventario</h1>
      <p className="text-sm text-gray-500 mb-6">
        Existencias reales por ubicación (2 centros de distribución y 32 tiendas), movimientos y ajustes por conteo
        físico.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto por nombre…"
          className="flex-1 border border-linea rounded px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {resultados.length > 0 && (
        <div className="bg-white border border-linea rounded divide-y divide-linea mb-6">
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => seleccionar(p)}
              className="w-full text-left flex items-center justify-between p-3 text-sm hover:bg-crema/40"
            >
              <span>{p.nombre}</span>
              <span className="text-xs text-gray-400">{p.sku}</span>
            </button>
          ))}
        </div>
      )}

      {producto && disponibilidad && (
        <div className="space-y-4">
          <div className="bg-white border border-linea rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-ink">
                {producto.nombre} <span className="text-xs text-gray-400">({producto.sku})</span>
              </h2>
              <span className="text-sm font-semibold text-ink">{disponibilidad.totalAvailable} disponibles</span>
            </div>
            <div className="divide-y divide-linea">
              {disponibilidad.byLocation.map((loc) => (
                <div key={loc.locationCode} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-600">
                    {loc.locationName} <span className="text-xs text-gray-400">({loc.locationCode})</span>
                  </span>
                  <span className="font-medium text-ink">{loc.available}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={registrarMovimiento} className="bg-white border border-linea rounded p-4">
            <h3 className="text-sm font-medium text-ink mb-3">Registrar movimiento</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
                <input
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  placeholder="CD1, T-014…"
                  className="w-full border border-linea rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as 'IN' | 'OUT')}
                  className="w-full border border-linea rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Salida</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  type="number"
                  min={1}
                  className="w-full border border-linea rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Reposición, merma, devolución…"
                  className="w-full border border-linea rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Registrar'}
            </Button>
          </form>

          <div className="bg-white border border-linea rounded p-4">
            <h3 className="text-sm font-medium text-ink mb-3">Últimos movimientos</h3>
            {movimientos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin movimientos registrados todavía.</p>
            ) : (
              <div className="divide-y divide-linea">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span className={m.type === 'IN' ? 'text-ok' : 'text-falla'}>
                      {m.type === 'IN' ? '+' : '-'}
                      {m.quantity}
                    </span>
                    <span className="text-xs text-gray-400">{m.locationCode}</span>
                    <span className="text-xs text-gray-500 flex-1 px-3">{m.reason}</span>
                    <span className="text-xs text-gray-400">{formatFecha(m.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
