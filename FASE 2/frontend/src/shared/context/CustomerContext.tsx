import { createContext, useContext, type ReactNode } from 'react'

export interface Customer {
  id: string
  nombre: string
}

const DEMO_CUSTOMER: Customer = { id: 'cliente-demo-1', nombre: 'Ana P.' }

const CustomerContext = createContext<Customer>(DEMO_CUSTOMER)

export function CustomerProvider({ children }: { children: ReactNode }) {
  return <CustomerContext.Provider value={DEMO_CUSTOMER}>{children}</CustomerContext.Provider>
}

export function useCustomer(): Customer {
  return useContext(CustomerContext)
}
