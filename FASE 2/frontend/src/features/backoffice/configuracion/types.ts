export interface Parametro {
  key: string
  value: string
  description: string | null
}

export type RolSistema = 'ADMIN' | 'STORE_EMPLOYEE' | 'STORE_MANAGER' | 'CALL_CENTER_AGENT' | 'LOGISTICS' | 'FINANCE'

export interface UsuarioSistema {
  id: number
  username: string
  fullName: string
  email: string | null
  active: boolean
  storeId: number | null
  roles: RolSistema[]
  lastLoginAt: string | null
}
