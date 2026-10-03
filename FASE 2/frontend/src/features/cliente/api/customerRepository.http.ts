import type { CustomerRepository, DatosCliente } from './customerRepository'
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
  return {
    id: String(backendCliente.id),
    nombre: backendCliente.fullName,
    telefono: backendCliente.phone ?? '',
    email: backendCliente.email ?? '',
    direccion: backendCliente.address ?? '',
  }
}

// El backend reemplaza el registro completo en cada PUT/POST (no hace un merge parcial): un campo
// que no se manda aquí llega como null al otro lado y borra lo que el cliente ya tenía guardado.
// Por eso quien llama a updateCustomer debe pasar siempre el dato completo (ver CustomerContext).
function cuerpoDatos(datos: DatosCliente) {
  return JSON.stringify({
    fullName: datos.nombre,
    phone: datos.telefono ?? '',
    email: datos.email ?? '',
    address: datos.direccion ?? '',
  })
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
