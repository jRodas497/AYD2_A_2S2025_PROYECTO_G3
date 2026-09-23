export interface NavItem {
  label: string
  path: string
  estado: 'activo' | 'proximamente'
}

export interface NavSection {
  titulo: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titulo: 'Comprar',
    items: [
      { label: 'Catálogo', path: '/catalogo', estado: 'activo' },
      { label: 'Promociones', path: '/promociones', estado: 'activo' },
      { label: 'Carrito', path: '/carrito', estado: 'activo' },
    ],
  },
  {
    titulo: 'Mis compras',
    items: [
      { label: 'Checkout', path: '/checkout', estado: 'proximamente' },
      { label: 'Mis órdenes', path: '/mis-ordenes', estado: 'proximamente' },
      { label: 'Notificaciones', path: '/notificaciones', estado: 'proximamente' },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [{ label: 'Perfil', path: '/perfil', estado: 'proximamente' }],
  },
]
