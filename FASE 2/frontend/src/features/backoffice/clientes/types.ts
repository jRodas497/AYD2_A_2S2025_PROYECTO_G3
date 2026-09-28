export interface ClienteResumen {
  id: string
  nombre: string
  email: string
  telefono: string
}

export interface OrdenDeCliente {
  orderId: string
  fecha: string
  canal: string
  estado: string
  total: number
}

export interface IncidenciaDeCliente {
  id: number
  orderId: number
  tipo: string
  estado: string
  descripcion: string
  creadaEn: string
}

export interface ClienteDetalle extends ClienteResumen {
  direccion: string
  taxId: string
  ordenes: OrdenDeCliente[]
  incidencias: IncidenciaDeCliente[]
}
