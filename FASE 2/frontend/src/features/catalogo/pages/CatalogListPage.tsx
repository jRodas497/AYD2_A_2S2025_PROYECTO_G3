import { useCatalogo } from '../hooks/useCatalogo'
import { ProductCard } from '../components/ProductCard'
import type { Categoria } from '../types'

const CATEGORIAS: { valor: Categoria | undefined; etiqueta: string }[] = [
  { valor: undefined, etiqueta: 'Todas' },
  { valor: 'linea_blanca', etiqueta: 'Línea blanca' },
  { valor: 'electronica', etiqueta: 'Electrónica' },
  { valor: 'ropa', etiqueta: 'Ropa' },
  { valor: 'calzado', etiqueta: 'Calzado' },
]

export function CatalogListPage() {
  const { productos, cargando, error, categoria, setCategoria, query, setQuery } = useCatalogo()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Catálogo</h1>

      <input
        type="text"
        placeholder="Buscar por nombre..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-xs border border-linea rounded px-3 py-2 text-sm mb-3 bg-white"
      />

      <div className="flex gap-2 flex-wrap mb-4">
        {CATEGORIAS.map((c) => (
          <button
            key={c.etiqueta}
            onClick={() => setCategoria(c.valor)}
            className={`text-xs px-3 py-1 rounded-full border ${
              categoria === c.valor ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-linea'
            }`}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando catálogo…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : productos.length === 0 ? (
        <p className="text-sm text-gray-400">No se encontraron productos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {productos.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}
    </div>
  )
}
