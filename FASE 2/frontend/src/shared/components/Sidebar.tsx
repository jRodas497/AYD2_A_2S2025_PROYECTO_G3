import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { visibleNavigation } from '../../app/navigation'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, type StaffRole } from '../auth/accessPolicy'
import { useCustomer } from '../context/CustomerContext'

export function Sidebar() {
  const { customer, logout } = useCustomer()
  const navigate = useNavigate()
  const { session, verified, logout: logoutStaff } = useAuth()
  const staffArea = useLocation().pathname.startsWith('/administracion')
  const sections = visibleNavigation(staffArea, verified ? session?.roles ?? [] : [], !!customer)
  const [open, setOpen] = useState(false)

  function handleSesion() {
    if (staffArea) { logoutStaff(); navigate('/administracion/login'); return }
    if (customer) {
      logout()
    }
    navigate('/ingresar')
  }

  return (
    <>
    <button aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)} className="sm:hidden fixed top-3 left-2 z-50 bg-brand text-white rounded px-2 py-1 text-xs">{open ? 'Cerrar' : 'Menú'}</button>
    {open && <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="sm:hidden fixed inset-0 z-30 bg-black/30" />}
    <aside className={`${open ? 'flex' : 'hidden'} sm:flex fixed sm:static inset-y-0 left-0 z-40 w-60 shrink-0 bg-brand text-white flex-col`}>
      <div className="px-5 py-5 text-lg font-semibold tracking-tight border-b border-white/15">
        MegaStore
      </div>
      {staffArea && verified && session && <p className="px-5 pt-3 text-xs text-white/70">{session.roles.map(r => ROLE_LABELS[r as StaffRole] ?? r).join(' · ')}</p>}
      <nav className="sidebar-nav flex-1 overflow-y-auto py-4">
        {sections.map((seccion) => (
          <div key={seccion.titulo} className="mb-5 px-3">
            <div className="px-2 mb-1 text-[11px] font-medium text-white/60">{seccion.titulo}</div>
            <ul>
              {seccion.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    onClick={() => setOpen(false)}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2 py-2 rounded text-sm ${
                        isActive ? 'bg-white/15 font-medium' : 'text-white/85 hover:bg-white/10'
                      }`
                    }
                  >
                    <item.icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.estado === 'proximamente' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/15 text-white/70 whitespace-nowrap">
                        Pronto
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        onClick={handleSesion}
        className="text-left px-5 py-3 text-xs text-white/60 hover:text-white border-t border-white/15"
      >
        {staffArea ? (session ? `${session.username} · Cerrar sesión` : 'Acceso de personal') : customer ? `${customer.nombre} · Cerrar sesión` : 'Iniciar sesión'}
      </button>
    </aside>
    </>
  )
}
