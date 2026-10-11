import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCustomer } from '../context/CustomerContext'
export function CustomerGate({ children }: { children: ReactNode }) {
  const { customer, checking } = useCustomer()
  const location = useLocation()
  return checking?<p role="status">Verificando sesión…</p>:customer ? children : <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
}
