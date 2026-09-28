import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { httpClientesRepository } from '../api/clientesRepository.http'
import type { ClienteResumen } from '../types'

export function ClientesPage() {
  const [q, setQ] = useState('')
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    setCargando(true)
    setError(null)
    try {
      setClientes(await httpClientesRepository.search(q.trim(), 100))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Clientes</h1>
      <p className="text-sm text-gray-500 mb-6">Busca por nombre, correo o teléfono para atender un caso.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="flex gap-2 mb-6"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, correo o teléfono…"
          className="flex-1 border border-linea rounded px-3 py-2 text-sm"
        />
        <button type="submit" className="text-sm text-brand hover:underline px-2">
          Buscar
        </button>
      </form>

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando clientes…</p>
      ) : error ? (
        <p className="text-sm text-falla">{error}</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-gray-400">Sin clientes con esa búsqueda.</p>
      ) : (
        <div className="bg-white border border-linea rounded divide-y divide-linea">
          {clientes.map((c) => (
            <Link
              key={c.id}
              to={`/administracion/clientes/${c.id}`}
              className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-crema/40"
            >
              <span className="font-medium text-ink">{c.nombre}</span>
              <span className="text-gray-500">{c.email || '—'}</span>
              <span className="text-xs text-gray-400">{c.telefono || '—'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
