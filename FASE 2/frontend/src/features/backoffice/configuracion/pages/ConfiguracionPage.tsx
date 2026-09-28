import { useEffect, useState } from 'react'
import { Button } from '../../../../shared/components/Button'
import { Pill } from '../../../../shared/components/Pill'
import { useAuth } from '../../../../shared/context/AuthContext'
import { useNotify } from '../../../../shared/notifications/NotificationContext'
import { httpConfiguracionRepository } from '../api/configuracionRepository.http'
import type { Parametro, RolSistema, UsuarioSistema } from '../types'

const ROLES: RolSistema[] = ['ADMIN', 'STORE_EMPLOYEE', 'STORE_MANAGER', 'CALL_CENTER_AGENT', 'LOGISTICS', 'FINANCE']

export function ConfiguracionPage() {
  const { isAdmin } = useAuth()
  const { notificar } = useNotify()

  const [parametros, setParametros] = useState<Parametro[]>([])
  const [edicionParametro, setEdicionParametro] = useState<{ key: string; value: string } | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nuevo, setNuevo] = useState({ username: '', fullName: '', email: '', password: '' })
  const [nuevoRoles, setNuevoRoles] = useState<RolSistema[]>(['STORE_EMPLOYEE'])
  const [creando, setCreando] = useState(false)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [p, u] = await Promise.all([
        httpConfiguracionRepository.listSettings(),
        httpConfiguracionRepository.listUsers(),
      ])
      setParametros(p)
      setUsuarios(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardarParametro() {
    if (!edicionParametro) return
    try {
      await httpConfiguracionRepository.updateSetting(edicionParametro.key, edicionParametro.value)
      notificar('Parámetro actualizado.', 'ok')
      setEdicionParametro(null)
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo actualizar (¿iniciaste sesión como ADMIN?)', 'falla')
    }
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    try {
      await httpConfiguracionRepository.createUser({ ...nuevo, roles: nuevoRoles })
      notificar('Usuario creado.', 'ok')
      setNuevo({ username: '', fullName: '', email: '', password: '' })
      setNuevoRoles(['STORE_EMPLOYEE'])
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo crear el usuario (¿iniciaste sesión como ADMIN?)', 'falla')
    } finally {
      setCreando(false)
    }
  }

  async function alternarActivo(u: UsuarioSistema) {
    try {
      await httpConfiguracionRepository.setActive(u.id, !u.active)
      await cargar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'No se pudo cambiar el estado del usuario', 'falla')
    }
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando configuración…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-6">Parámetros del sistema y personal interno con acceso al backoffice.</p>
      {!isAdmin && (
        <p className="text-xs text-alerta mb-4">
          Solo se puede consultar sin sesión de ADMIN. Inicia sesión de personal para editar.
        </p>
      )}

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <h2 className="text-sm font-medium text-ink mb-3">Parámetros</h2>
        <div className="divide-y divide-linea">
          {parametros.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium text-ink">{p.key}</div>
                <div className="text-xs text-gray-400">{p.description}</div>
              </div>
              {edicionParametro?.key === p.key ? (
                <div className="flex items-center gap-2">
                  <input
                    value={edicionParametro.value}
                    onChange={(e) => setEdicionParametro({ key: p.key, value: e.target.value })}
                    className="border border-linea rounded px-2 py-1 text-sm w-28"
                  />
                  <button onClick={guardarParametro} className="text-xs text-brand hover:underline">
                    Guardar
                  </button>
                  <button onClick={() => setEdicionParametro(null)} className="text-xs text-gray-400 hover:underline">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{p.value}</span>
                  {isAdmin && (
                    <button
                      onClick={() => setEdicionParametro({ key: p.key, value: p.value })}
                      className="text-xs text-brand hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <h2 className="text-sm font-medium text-ink mb-3">Personal con acceso</h2>
        <div className="divide-y divide-linea">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium text-ink">{u.fullName}</div>
                <div className="text-xs text-gray-400">
                  {u.username} · {u.roles.join(', ') || 'sin rol'}
                </div>
              </div>
              <Pill tone={u.active ? 'ok' : 'falla'}>{u.active ? 'Activo' : 'Deshabilitado'}</Pill>
              {isAdmin && (
                <button onClick={() => alternarActivo(u)} className="text-xs text-brand hover:underline">
                  {u.active ? 'Deshabilitar' : 'Activar'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={crearUsuario} className="bg-white border border-linea rounded p-4">
          <h2 className="text-sm font-medium text-ink mb-3">Crear usuario</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={nuevo.username}
              onChange={(e) => setNuevo({ ...nuevo, username: e.target.value })}
              placeholder="Usuario"
              required
              className="border border-linea rounded px-3 py-2 text-sm"
            />
            <input
              value={nuevo.fullName}
              onChange={(e) => setNuevo({ ...nuevo, fullName: e.target.value })}
              placeholder="Nombre completo"
              required
              className="border border-linea rounded px-3 py-2 text-sm"
            />
            <input
              value={nuevo.email}
              onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              placeholder="Correo"
              type="email"
              className="border border-linea rounded px-3 py-2 text-sm"
            />
            <input
              value={nuevo.password}
              onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              placeholder="Contraseña"
              type="password"
              required
              className="border border-linea rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Roles</label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={nuevoRoles.includes(r)}
                    onChange={(e) =>
                      setNuevoRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={creando || nuevoRoles.length === 0}>
            {creando ? 'Creando…' : 'Crear usuario'}
          </Button>
        </form>
      )}
    </div>
  )
}
