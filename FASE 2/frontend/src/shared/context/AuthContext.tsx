import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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
    return typeof valor?.token === 'string' && typeof valor.username === 'string' && Array.isArray(valor.roles) ? (valor as Session) : null
  } catch {
    return null
  }
}

interface AuthContextValue {
  session: Session | null
  isAdmin: boolean
  verified: boolean
  verificationError: string | null
  refreshSession: () => Promise<void>
  loginError: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => cargarSesion())
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  useEffect(() => {
    function expired(event: Event) {
      if ((event as CustomEvent<string>).detail !== STORAGE_KEY) return
      localStorage.removeItem(STORAGE_KEY); setSession(null); setLoginError('La sesión venció. Ingresa de nuevo.')
    }
    window.addEventListener('sgo-session-expired', expired)
    return () => window.removeEventListener('sgo-session-expired', expired)
  }, [])

  const token = session?.token
  const refreshSession = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (cargarSesion()?.token !== token) return
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(STORAGE_KEY); setSession(null); setVerifiedToken(null)
        setLoginError('La sesión venció o fue revocada. Ingresa de nuevo.'); return
      }
      const current = await manejarRespuesta<{ username: string; roles: string[] }>(response)
      if (cargarSesion()?.token !== token) return
      const next = { token, ...current }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSession(next)
      setVerifiedToken(token); setVerificationError(null)
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'No se pudo verificar la sesión')
    }
  }, [token])
  useEffect(() => {
    if (!token) return
    void refreshSession()
    const timer = setInterval(() => void refreshSession(), 10000)
    const focus = () => { void refreshSession() }
    window.addEventListener('focus', focus)
    return () => { clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [token, refreshSession])
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      const next = cargarSesion()
      setSession(next); setVerifiedToken(null)
      if (next?.token === token) void refreshSession()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [token, refreshSession])

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
      setVerifiedToken(nuevaSesion.token); setVerificationError(null)
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

  const verified = !!session && verifiedToken === session.token
  const isAdmin = verified && (session?.roles.includes('ADMIN') ?? false)

  return (
    <AuthContext.Provider value={{ session, isAdmin, verified, verificationError, refreshSession, loginError, loggingIn, login, logout }}>
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
