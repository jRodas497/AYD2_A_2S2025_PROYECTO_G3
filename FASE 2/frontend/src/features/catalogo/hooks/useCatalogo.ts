import { useEffect, useState } from 'react'
import { httpCatalogRepository as catalogRepository } from '../api/catalogRepository.http'
import type { Categoria, Product } from '../types'

export function useCatalogo() {
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState<Categoria | undefined>(undefined)
  const [productos, setProductos] = useState<Product[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    const temporizador = setTimeout(() => {
      catalogRepository
        .search(query, categoria)
        .then((resultado) => {
          if (cancelado) return
          setProductos(resultado)
          setCargando(false)
        })
        .catch((e) => {
          if (cancelado) return
          setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')
          setCargando(false)
        })
    }, 300)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [query, categoria])

  return { productos, cargando, error, categoria, setCategoria, query, setQuery }
}

export function useProducto(id: string | undefined) {
  const [producto, setProducto] = useState<Product | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    setCargando(true)
    setError(null)
    catalogRepository
      .getById(id)
      .then((resultado) => {
        if (cancelado) return
        setProducto(resultado)
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el producto')
        setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [id])

  return { producto, cargando, error }
}
