import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCustomerRepository } from '../../features/cliente/api/customerRepository.http'
import type { Customer } from '../../features/cliente/types'

export type { Customer }

const STORAGE_KEY = 'sgo-customer-id'

let creacionEnCurso: Promise<Customer> | null = null

async function obtenerOCrearCliente(): Promise<Customer> {
  const idGuardado = localStorage.getItem(STORAGE_KEY)
  if (idGuardado) {
    const existente = await httpCustomerRepository.getCustomer(idGuardado)
    if (existente) return existente
  }
  if (!creacionEnCurso) {
    creacionEnCurso = httpCustomerRepository.createCustomer({ nombre: 'Cliente invitado' }).then((cliente) => {
      localStorage.setItem(STORAGE_KEY, cliente.id)
      return cliente
    })
  }
  return creacionEnCurso
}

export interface ResultadoActualizarPerfil {
  ok: boolean
  motivo?: string
}

interface CustomerContextValue {
  customer: Customer
  needsReidentification: boolean
  identifyError: string | null
  requestReidentification: () => void
  identify: (datos: { nombre: string; telefono: string }) => Promise<void>
  actualizarPerfil: (datos: { nombre: string; telefono: string; email: string; direccion: string }) => Promise<ResultadoActualizarPerfil>
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cargando, setCargando] = useState(true)
  const [needsReidentification, setNeedsReidentification] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [identifyError, setIdentifyError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function inicializar() {
      try {
        const clienteActual = await obtenerOCrearCliente()
        if (!cancelado) {
          setCustomer(clienteActual)
          setCargando(false)
        }
      } catch (e) {
        if (!cancelado) {
          setBootstrapError(e instanceof Error ? e.message : 'No se pudo cargar tu información de cliente')
          setCargando(false)
        }
      }
    }

    inicializar()
    return () => {
      cancelado = true
    }
  }, [])

  function requestReidentification() {
    setNeedsReidentification(true)
  }

  async function identify(datos: { nombre: string; telefono: string }) {
    if (!customer) return
    setIdentifyError(null)
    try {
      // El backend reemplaza el registro completo: se manda también el email y la dirección que
      // ya tenía, para que reidentificarse no los borre (ver customerRepository.http.ts).
      const actualizado = await httpCustomerRepository.updateCustomer(customer.id, {
        ...datos,
        email: customer.email,
        direccion: customer.direccion,
      })
      if (actualizado) {
        setCustomer(actualizado)
        setNeedsReidentification(false)
      } else {
        setIdentifyError('No encontramos tu perfil de cliente. Intenta de nuevo más tarde.')
      }
    } catch (e) {
      setIdentifyError(e instanceof Error ? e.message : 'No se pudo guardar tu información')
    }
  }

  async function actualizarPerfil(datos: {
    nombre: string
    telefono: string
    email: string
    direccion: string
  }): Promise<ResultadoActualizarPerfil> {
    if (!customer) return { ok: false, motivo: 'No se pudo identificar tu perfil' }
    try {
      const actualizado = await httpCustomerRepository.updateCustomer(customer.id, datos)
      if (!actualizado) return { ok: false, motivo: 'No encontramos tu perfil de cliente' }
      setCustomer(actualizado)
      return { ok: true }
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo guardar tu información' }
    }
  }

  if (bootstrapError) {
    return (
      <div className="h-screen flex items-center justify-center bg-crema">
        <p className="text-sm text-falla">{bootstrapError}</p>
      </div>
    )
  }

  if (cargando || !customer) {
    return (
      <div className="h-screen flex items-center justify-center bg-crema">
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    )
  }

  return (
    <CustomerContext.Provider
      value={{ customer, needsReidentification, identifyError, requestReidentification, identify, actualizarPerfil }}
    >
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer(): CustomerContextValue {
  const value = useContext(CustomerContext)
  if (!value) throw new Error('useCustomer debe usarse dentro de <CustomerProvider>')
  return value
}
