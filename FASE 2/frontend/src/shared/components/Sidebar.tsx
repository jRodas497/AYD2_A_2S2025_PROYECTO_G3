import { NavLink, useNavigate } from 'react-router-dom'
import { NAV_SECTIONS } from '../../app/navigation'
import { useCustomer } from '../context/CustomerContext'

export function Sidebar() {
  const { customer, logout } = useCustomer()
  const navigate = useNavigate()

  function handleSesion() {
    if (customer) {
      logout()
    }
    navigate('/ingresar')
  }

  return (
    <aside className="w-60 shrink-0 bg-brand text-white flex flex-col">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight border-b border-white/15">
        MegaStore
      </div>
      <nav className="sidebar-nav flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((seccion) => (
          <div key={seccion.titulo} className="mb-5 px-3">
            <div className="px-2 mb-1 text-[11px] font-medium text-white/60">{seccion.titulo}</div>
            <ul>
              {seccion.items.map((item) => (
                <li key={item.path}>
                  <NavLink
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
        {customer ? `${customer.nombre} · Cerrar sesión` : 'Iniciar sesión'}
      </button>
    </aside>
  )
}
