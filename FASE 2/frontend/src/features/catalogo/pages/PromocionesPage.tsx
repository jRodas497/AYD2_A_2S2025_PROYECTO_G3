import { useEffect, useState } from 'react'
import { httpPricingRepository } from '../api/pricingRepository.http'
import type { Promotion } from '../api/pricingRepository'

export function PromocionesPage() {
  const [promociones, setPromociones] = useState<Promotion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    httpPricingRepository.listActivePromotions().then((resultado) => {
      setPromociones(resultado)
      setCargando(false)
    }).catch(e => { setError(e.message); setCargando(false) })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Promociones vigentes</h1>
      {error && <p role="alert" className="text-falla">{error}</p>}
      {!cargando && promociones.length === 0 && <p>No hay promociones vigentes.</p>}
      {cargando ? (
        <p className="text-sm text-gray-400">Cargando promociones…</p>
      ) : (
        <div className="space-y-3">
          {promociones.map((promo) => (
            <div key={promo.id} className="bg-white border border-linea rounded p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-ink">{promo.nombre}</span>
                <span className="text-sm font-bold text-ok">-{promo.descuentoPorcentaje}%</span>
              </div>
              <p className="text-xs text-gray-500">{promo.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
