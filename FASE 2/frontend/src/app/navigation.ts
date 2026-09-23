import {
  Bell,
  ClipboardCheck,
  LayoutGrid,
  Package,
  ShoppingCart,
  Tag,
  User,
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
      { label: 'Mis órdenes', path: '/mis-ordenes', estado: 'proximamente', icon: Package },
      { label: 'Notificaciones', path: '/notificaciones', estado: 'proximamente', icon: Bell },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [{ label: 'Perfil', path: '/perfil', estado: 'proximamente', icon: User }],
  },
]
