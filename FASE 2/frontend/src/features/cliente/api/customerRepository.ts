import type { Customer } from '../types'

export interface CustomerRepository {
  getCustomer(id: string): Promise<Customer | null>
  createCustomer(datos: { nombre: string; telefono?: string }): Promise<Customer>
  updateCustomer(id: string, datos: { nombre: string; telefono?: string }): Promise<Customer | null>
}
