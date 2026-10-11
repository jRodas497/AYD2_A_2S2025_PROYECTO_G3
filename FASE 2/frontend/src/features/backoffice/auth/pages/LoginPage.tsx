import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/components/Button'
import { useAuth } from '../../../../shared/context/AuthContext'

export function LoginPage() {
  const { session, isAdmin, loginError, loggingIn, login, logout } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await login(username, password)
    if (ok) navigate('/administracion')
  }

  if (session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ink mb-4">Sesión de administración</h1>
        <p className="text-sm text-gray-500 mb-1">
          Conectado como <strong>{session.username}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-4">Roles: {session.roles.join(', ') || 'sin rol asignado'}</p>
        {!isAdmin && (
          <p className="text-sm text-alerta mb-4">
            Los paneles y acciones disponibles corresponden a los roles asignados a esta cuenta.
          </p>
        )}
        <Button variant="secondary" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold text-ink mb-1">Iniciar sesión</h1>
      <p className="text-sm text-gray-500 mb-6">Acceso de personal interno (administración, logística, Finanzas).</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="login-usuario" className="block text-xs text-gray-500 mb-1">Usuario</label>
          <input
            id="login-usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-xs text-gray-500 mb-1">Contraseña</label>
          <input
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        {loginError && <p className="text-sm text-falla">{loginError}</p>}
        <Button type="submit" disabled={loggingIn}>
          {loggingIn ? 'Ingresando…' : 'Ingresar'}
        </Button>

      </form>
    </div>
  )
}
