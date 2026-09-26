import type { CustomerRepository } from './customerRepository'
import type { Customer } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'

interface BackendCustomer {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  createdAt: string
}

function mapearCliente(backendCliente: BackendCustomer): Customer {
  return { id: String(backendCliente.id), nombre: backendCliente.fullName, telefono: backendCliente.phone ?? '' }
}

function cuerpoDatos(datos: { nombre: string; telefono?: string }) {
  return JSON.stringify({ fullName: datos.nombre, phone: datos.telefono })
}

export const httpCustomerRepository: CustomerRepository = {
  async getCustomer(id) {
    try {
      const backendCliente = await manejarRespuesta<BackendCustomer>(await fetch(`/api/customers/${id}`))
      return mapearCliente(backendCliente)
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },

  async createCustomer(datos) {
    const backendCliente = await manejarRespuesta<BackendCustomer>(
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cuerpoDatos(datos),
      }),
    )
    return mapearCliente(backendCliente)
  },

  async updateCustomer(id, datos) {
    try {
      const backendCliente = await manejarRespuesta<BackendCustomer>(
        await fetch(`/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: cuerpoDatos(datos),
        }),
      )
      return mapearCliente(backendCliente)
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },
}
