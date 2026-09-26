import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookmarkCheck,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  History,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
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
      { label: 'Notificaciones', path: '/notificaciones', estado: 'proximamente', icon: Bell },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [{ label: 'Perfil', path: '/perfil', estado: 'proximamente', icon: User }],
  },
  {
    titulo: 'Panel administrativo',
    items: [{ label: 'Dashboard', path: '/administracion/dashboard', estado: 'activo', icon: LayoutDashboard }],
  },
  {
    titulo: 'Operaciones (admin)',
    items: [
      { label: 'Órdenes', path: '/administracion/ordenes', estado: 'proximamente', icon: ClipboardList },
      { label: 'Incidencias', path: '/administracion/incidencias', estado: 'proximamente', icon: AlertTriangle },
      { label: 'Devoluciones', path: '/administracion/devoluciones', estado: 'proximamente', icon: Undo2 },
      { label: 'Inventario', path: '/administracion/inventario', estado: 'proximamente', icon: Boxes },
      { label: 'Reservas', path: '/administracion/reservas', estado: 'proximamente', icon: BookmarkCheck },
      { label: 'Logística', path: '/administracion/logistica', estado: 'proximamente', icon: Truck },
      { label: 'Seguimiento', path: '/administracion/seguimiento', estado: 'proximamente', icon: MapPin },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Clientes', path: '/administracion/clientes', estado: 'proximamente', icon: Users },
      { label: 'Auditoría', path: '/administracion/auditoria', estado: 'proximamente', icon: History },
      { label: 'Reportes', path: '/administracion/reportes', estado: 'activo', icon: BarChart3 },
      { label: 'Configuración', path: '/administracion/configuracion', estado: 'proximamente', icon: Settings },
    ],
  },
]
