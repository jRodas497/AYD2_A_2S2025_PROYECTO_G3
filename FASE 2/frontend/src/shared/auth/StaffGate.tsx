import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessStaffPath, staffHome } from './accessPolicy'
export function StaffGate({ children }: { children: ReactNode }) {
  const { session, verified, verificationError, refreshSession } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/administracion/login" replace state={{ from: location.pathname }} />
  if (!verified) return <div role="status"><p>{verificationError ?? 'Verificando sesión de personal…'}</p>{verificationError && <button onClick={() => void refreshSession()} className="text-brand">Reintentar</button>}</div>
  if (!canAccessStaffPath(session.roles, location.pathname)) return <div role="alert"><h1 className="text-2xl font-semibold mb-3">Acceso restringido</h1><p>Tu cuenta no tiene permisos para esta sección.</p><Link className="text-brand" to={staffHome(session.roles)}>Volver a mi panel</Link></div>
  return children
}
