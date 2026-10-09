import type { CustomerRepository, DatosCliente, DatosLogin, DatosRegistro, SesionCliente } from './customerRepository'
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

interface BackendSession {
  token: string
  customerId: number
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
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

function mapearSesion(sesion: BackendSession): SesionCliente {
  return {
    id: String(sesion.customerId),
    nombre: sesion.fullName,
    telefono: sesion.phone ?? '',
    email: sesion.email ?? '',
    direccion: sesion.address ?? '',
    token: sesion.token,
  }
}

// El backend reemplaza el registro completo en cada PUT/POST (no hace un merge parcial): un campo
// que no se manda aquí llega como null al otro lado y borra lo que el cliente ya tenía guardado.
// Por eso quien llama a updateCustomer debe pasar siempre el dato completo (ver CustomerContext).
function cuerpoDatos(datos: DatosCliente) {
  return JSON.stringify({
    fullName: datos.nombre,
    phone: datos.telefono ?? '',
    // customers.customer.email es unique en la base: un '' colisiona con el siguiente cliente sin
    // correo (dos clientes invitados, por ejemplo). null sí se puede repetir, '' no.
    email: datos.email?.trim() ? datos.email.trim() : null,
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

  async register(datos: DatosRegistro) {
    const sesion = await manejarRespuesta<BackendSession>(
      await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: datos.nombre,
          email: datos.email,
          password: datos.password,
          phone: datos.telefono ?? '',
          address: datos.direccion ?? '',
        }),
      }),
    )
    return mapearSesion(sesion)
  },

  async login(datos: DatosLogin) {
    const sesion = await manejarRespuesta<BackendSession>(
      await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: datos.email, password: datos.password }),
      }),
    )
    return mapearSesion(sesion)
  },
}
