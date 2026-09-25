import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCustomerRepository } from '../../features/cliente/api/customerRepository.http'
import type { Customer } from '../../features/cliente/types'

export type { Customer }

const STORAGE_KEY = 'sgo-customer-id'

interface CustomerContextValue {
  customer: Customer
  needsReidentification: boolean
  identifyError: string | null
  requestReidentification: () => void
  identify: (datos: { nombre: string; telefono: string }) => Promise<void>
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
        const idGuardado = localStorage.getItem(STORAGE_KEY)
        let clienteActual: Customer | null = idGuardado ? await httpCustomerRepository.getCustomer(idGuardado) : null

        if (!clienteActual) {
          clienteActual = await httpCustomerRepository.createCustomer({ nombre: 'Cliente invitado' })
          localStorage.setItem(STORAGE_KEY, clienteActual.id)
        }

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
      const actualizado = await httpCustomerRepository.updateCustomer(customer.id, datos)
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
    <CustomerContext.Provider value={{ customer, needsReidentification, identifyError, requestReidentification, identify }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer(): CustomerContextValue {
  const value = useContext(CustomerContext)
  if (!value) throw new Error('useCustomer debe usarse dentro de <CustomerProvider>')
  return value
}
