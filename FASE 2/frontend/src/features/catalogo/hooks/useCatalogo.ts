import { useEffect, useState } from 'react'
import { mockCatalogRepository } from '../api/catalogRepository.mock'
import type { Categoria, Product } from '../types'

const catalogRepository = mockCatalogRepository

export function useCatalogo() {
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState<Categoria | undefined>(undefined)
  const [productos, setProductos] = useState<Product[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    catalogRepository.search(query, categoria).then((resultado) => {
      if (!cancelado) {
        setProductos(resultado)
        setCargando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [query, categoria])

  return { productos, cargando, categoria, setCategoria, query, setQuery }
}

export function useProducto(id: string | undefined) {
  const [producto, setProducto] = useState<Product | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    setCargando(true)
    catalogRepository.getById(id).then((resultado) => {
      if (!cancelado) {
        setProducto(resultado)
        setCargando(false)
      }
    })
    return () => {
      cancelado = true
    }
  }, [id])

  return { producto, cargando }
}
