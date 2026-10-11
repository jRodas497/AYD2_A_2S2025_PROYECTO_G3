import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { useCustomer } from '../../../shared/context/CustomerContext'

export function CustomerLoginPage() {
  const { customer, authError, submitting, login, register } = useCustomer()
  const navigate = useNavigate()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')

  if (customer) return <Navigate to="/catalogo" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok =
      modo === 'login'
        ? await login(email, password)
        : await register({ nombre, email, password, telefono, direccion })
    if (ok) navigate('/catalogo')
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold text-ink mb-1">{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tu cuenta guarda tu propio carrito, tus compras, tus facturas y tu historial — cada cliente ve lo suyo.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {modo === 'registro' && (
          <div>
            <label htmlFor="cliente-nombre" className="block text-xs text-gray-500 mb-1">Nombre</label>
            <input
              id="cliente-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full border border-linea rounded px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label htmlFor="cliente-email" className="block text-xs text-gray-500 mb-1">Correo</label>
          <input
            id="cliente-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="cliente-password" className="block text-xs text-gray-500 mb-1">Contraseña</label>
          <input
            id="cliente-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        {modo === 'registro' && (
          <>
            <div>
              <label htmlFor="cliente-telefono" className="block text-xs text-gray-500 mb-1">Teléfono (opcional)</label>
              <input
                id="cliente-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cliente-direccion" className="block text-xs text-gray-500 mb-1">Dirección (opcional)</label>
              <input
                id="cliente-direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {authError && <p className="text-sm text-falla">{authError}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </Button>
        {modo==='login'&&<Link to="/recuperar" className="block text-sm text-brand">Olvidé mi contraseña</Link>}

        <button
          type="button"
          onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
          className="text-xs text-brand hover:underline block"
        >
          {modo === 'login' ? '¿No tienes cuenta? Crear una' : 'Ya tengo cuenta, iniciar sesión'}
        </button>

        {modo === 'login' && (
          <p className="text-[11px] text-gray-400">
            Cuentas de demo (contraseña <code>cliente123</code>): <code>maria@example.com</code>,{' '}
            <code>carlos@example.com</code>, <code>ana@example.com</code>, <code>jorge@example.com</code>,{' '}
            <code>lucia@example.com</code>.
          </p>
        )}
      </form>
    </div>
  )
}
