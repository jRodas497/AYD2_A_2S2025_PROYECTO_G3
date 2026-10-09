import type { Customer } from '../types'

export interface DatosCliente {
  nombre: string
  telefono?: string
  email?: string
  direccion?: string
}

export interface DatosRegistro {
  nombre: string
  email: string
  password: string
  telefono?: string
  direccion?: string
}

export interface DatosLogin {
  email: string
  password: string
}

/** Lo que devuelve el backend al iniciar sesión o registrarse: el cliente completo más el token. */
export interface SesionCliente extends Customer {
  token: string
}

export interface CustomerRepository {
  getCustomer(id: string): Promise<Customer | null>
  createCustomer(datos: DatosCliente): Promise<Customer>
  updateCustomer(id: string, datos: DatosCliente): Promise<Customer | null>
  register(datos: DatosRegistro): Promise<SesionCliente>
  login(datos: DatosLogin): Promise<SesionCliente>
}
