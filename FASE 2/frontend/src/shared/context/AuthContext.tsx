import { createContext, useContext, useState, type ReactNode } from 'react'
import { manejarRespuesta } from '../api/httpErrors'

const STORAGE_KEY = 'sgo-admin-auth'

interface Session {
  token: string
  username: string
  roles: string[]
}

interface BackendLoginResult {
  token: string
  username: string
  roles: string[]
}

function cargarSesion(): Session | null {
  const crudo = localStorage.getItem(STORAGE_KEY)
  if (!crudo) return null
  try {
    const valor = JSON.parse(crudo)
    return valor?.token ? (valor as Session) : null
  } catch {
    return null
  }
}

interface AuthContextValue {
  session: Session | null
  isAdmin: boolean
  loginError: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => cargarSesion())
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  async function login(username: string, password: string): Promise<boolean> {
    setLoggingIn(true)
    setLoginError(null)
    try {
      const resultado = await manejarRespuesta<BackendLoginResult>(
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        }),
      )
      const nuevaSesion: Session = { token: resultado.token, username: resultado.username, roles: resultado.roles }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaSesion))
      setSession(nuevaSesion)
      return true
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
      return false
    } finally {
      setLoggingIn(false)
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  const isAdmin = session?.roles.includes('ADMIN') ?? false

  return (
    <AuthContext.Provider value={{ session, isAdmin, loginError, loggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return value
}

/** Token actual, para las llamadas admin que lo necesitan sin tener que pasar por el hook. */
export function tokenActual(): string | null {
  return cargarSesion()?.token ?? null
}

/** Headers con Authorization si hay sesión; vacío si no (la llamada sigue igual, solo que sin permiso ADMIN). */
export function authHeaders(): Record<string, string> {
  const token = tokenActual()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
