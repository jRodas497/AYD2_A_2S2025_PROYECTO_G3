import { canAccessStaffPath } from '../shared/auth/accessPolicy'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookmarkCheck,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  estado: 'activo' | 'proximamente'
  icon: LucideIcon
}

export interface NavSection {
  titulo: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titulo: 'Comprar',
    items: [
      { label: 'Catálogo', path: '/catalogo', estado: 'activo', icon: LayoutGrid },
      { label: 'Promociones', path: '/promociones', estado: 'activo', icon: Tag },
      { label: 'Carrito', path: '/carrito', estado: 'activo', icon: ShoppingCart },
    ],
  },
  {
    titulo: 'Mis compras',
    items: [
      { label: 'Checkout', path: '/checkout', estado: 'activo', icon: ClipboardCheck },
      { label: 'Mis órdenes', path: '/mis-ordenes', estado: 'activo', icon: Package },
      { label: 'Notificaciones', path: '/notificaciones', estado: 'activo', icon: Bell },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [{ label: 'Mi crédito', path: '/credito', estado: 'activo', icon: BookmarkCheck }, { label: 'Perfil', path: '/perfil', estado: 'activo', icon: User }],
  },
  {
    titulo: 'Panel administrativo',
    items: [{ label: 'Dashboard', path: '/administracion/dashboard', estado: 'activo', icon: LayoutDashboard }],
  },
  {
    titulo: 'Operaciones',
    items: [
      { label: 'Órdenes', path: '/administracion/ordenes', estado: 'activo', icon: ClipboardList },
      { label: 'Incidencias', path: '/administracion/incidencias', estado: 'activo', icon: AlertTriangle },
      { label: 'Devoluciones', path: '/administracion/devoluciones', estado: 'activo', icon: Undo2 },
      { label: 'Catálogo y promociones', path: '/administracion/catalogo', estado: 'activo', icon: Tag },
      { label: 'Inventario', path: '/administracion/inventario', estado: 'activo', icon: Boxes },
      { label: 'Reservas', path: '/administracion/reservas', estado: 'activo', icon: BookmarkCheck },
      { label: 'Logística', path: '/administracion/logistica', estado: 'activo', icon: Truck },
      { label: 'Seguimiento', path: '/administracion/seguimiento', estado: 'activo', icon: MapPin },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Usuarios y roles', path: '/administracion/usuarios', estado: 'activo', icon: Users },
      { label: 'Clientes', path: '/administracion/clientes', estado: 'activo', icon: Users },
      { label: 'Auditoría', path: '/administracion/auditoria', estado: 'activo', icon: History },
      { label: 'Reportes', path: '/administracion/reportes', estado: 'activo', icon: BarChart3 },
      { label: 'ERP y conciliación', path: '/administracion/erp', estado: 'activo', icon: FileText },
      { label: 'Facturas', path: '/administracion/facturas', estado: 'activo', icon: FileText },
      { label: 'Configuración', path: '/administracion/configuracion', estado: 'activo', icon: Settings },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { label: 'Integraciones', path: '/administracion/integraciones', estado: 'activo', icon: Plug },
      { label: 'Notificaciones', path: '/administracion/notificaciones', estado: 'activo', icon: Bell },
    ],
  },
]

export function visibleNavigation(isStaffArea: boolean, roles: readonly string[], customerSignedIn: boolean): NavSection[] {
  return NAV_SECTIONS.map(section => ({ ...section, items: section.items.filter(item => {
    if (isStaffArea) return canAccessStaffPath(roles, item.path)
    if (item.path.startsWith('/administracion')) return false
    return customerSignedIn || ['/catalogo', '/promociones'].includes(item.path)
  }) })).filter(section => section.items.length > 0)
}
