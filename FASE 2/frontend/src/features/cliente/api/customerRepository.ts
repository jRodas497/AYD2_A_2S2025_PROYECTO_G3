import type { Customer } from '../types'

export interface DatosCliente {
  nombre: string
  telefono?: string
  email?: string
  direccion?: string
}

export interface CustomerRepository {
  getCustomer(id: string): Promise<Customer | null>
  createCustomer(datos: DatosCliente): Promise<Customer>
  updateCustomer(id: string, datos: DatosCliente): Promise<Customer | null>
}
