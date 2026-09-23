import { createContext, useContext, useState, type ReactNode } from 'react'

export interface Customer {
  id: string
  nombre: string
  telefono: string
}

interface CustomerContextValue {
  customer: Customer
  needsReidentification: boolean
  requestReidentification: () => void
  identify: (datos: { nombre: string; telefono: string }) => void
}

const DEMO_CUSTOMER: Customer = { id: 'cliente-demo-1', nombre: 'Ana P.', telefono: '5555-0101' }

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer>(DEMO_CUSTOMER)
  const [needsReidentification, setNeedsReidentification] = useState(false)

  function requestReidentification() {
    setNeedsReidentification(true)
  }

  function identify(datos: { nombre: string; telefono: string }) {
    setCustomer((actual) => ({ ...actual, nombre: datos.nombre, telefono: datos.telefono }))
    setNeedsReidentification(false)
  }

  return (
    <CustomerContext.Provider value={{ customer, needsReidentification, requestReidentification, identify }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer(): CustomerContextValue {
  const value = useContext(CustomerContext)
  if (!value) throw new Error('useCustomer debe usarse dentro de <CustomerProvider>')
  return value
}
