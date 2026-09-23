import { NavLink } from 'react-router-dom'
import { NAV_SECTIONS } from '../../app/navigation'

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-brand text-white flex flex-col">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight border-b border-white/15">
        MegaStore
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((seccion) => (
          <div key={seccion.titulo} className="mb-5 px-3">
            <div className="px-2 mb-1 text-[11px] font-medium text-white/60">{seccion.titulo}</div>
            <ul>
              {seccion.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2 px-2 py-2 rounded text-sm ${
                        isActive ? 'bg-white/15 font-medium' : 'text-white/85 hover:bg-white/10'
                      }`
                    }
                  >
                    <span>{item.label}</span>
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
    </aside>
  )
}
