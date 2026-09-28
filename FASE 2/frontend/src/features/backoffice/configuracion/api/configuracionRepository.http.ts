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
    return manejarRespuesta<UsuarioSistema[]>(await fetch('/api/users'))
  },

  async createUser(input: {
    username: string
    fullName: string
    email: string
    password: string
    roles: RolSistema[]
  }): Promise<UsuarioSistema> {
    return manejarRespuesta<UsuarioSistema>(
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      }),
    )
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
