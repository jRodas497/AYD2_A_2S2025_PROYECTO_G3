import { apiFetch as fetch } from '../../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../../shared/api/httpErrors'
import { authHeaders } from '../../../../shared/context/AuthContext'
import type { Parametro, RolSistema, UsuarioSistema } from '../types'

export const httpConfiguracionRepository = {
  async listSettings(): Promise<Parametro[]> {
    return manejarRespuesta<Parametro[]>(await fetch('/api/settings'))
  },

  async updateSetting(key: string, value: string): Promise<Parametro> {
    return manejarRespuesta<Parametro>(
      await fetch(`/api/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ value }),
      }),
    )
  },

  async listUsers(): Promise<UsuarioSistema[]> {
    return manejarRespuesta<UsuarioSistema[]>(await fetch('/api/users', { headers: authHeaders() }))
  },

  async createUser(input: {
    username: string
    fullName: string
    email: string
    password: string
    roles: RolSistema[]
    storeId?: number | null
  }): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      }),
    )
  },

  async updateUser(id: number, input: { fullName: string; email: string | null; storeId: number | null; roles: RolSistema[] }): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(await fetch(`/api/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(input),
    }))
  },
  async resetPassword(id: number, password: string): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(await fetch(`/api/users/${id}/password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ password }),
    }))
  },

  async updateRoles(id: number, roles: RolSistema[]): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(
      await fetch(`/api/users/${id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ roles }),
      }),
    )
  },

  async setActive(id: number, active: boolean): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(
      await fetch(`/api/users/${id}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ active }),
      }),
    )
  },
}
