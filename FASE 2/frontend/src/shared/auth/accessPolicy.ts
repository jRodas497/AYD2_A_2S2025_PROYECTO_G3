export const STAFF_ROLES = ['ADMIN', 'STORE_EMPLOYEE', 'STORE_MANAGER', 'CALL_CENTER_AGENT', 'LOGISTICS', 'FINANCE'] as const
export type StaffRole = typeof STAFF_ROLES[number]
export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Administración', STORE_EMPLOYEE: 'Personal de tienda', STORE_MANAGER: 'Gerencia de tienda',
  CALL_CENTER_AGENT: 'Atención al cliente', LOGISTICS: 'Logística', FINANCE: 'Finanzas',
}
const support = ['ADMIN', 'FINANCE', 'CALL_CENTER_AGENT', 'STORE_MANAGER', 'STORE_EMPLOYEE'] as const
export const PERMISSIONS = {
  dashboard: ['ADMIN', 'FINANCE'], orders: STAFF_ROLES, customers: support, incidents: support,
  locations: ['ADMIN', 'LOGISTICS'], transfers: STAFF_ROLES, editTransfers: ['ADMIN', 'LOGISTICS'],
  inventory: STAFF_ROLES, reservations: STAFF_ROLES, logistics: STAFF_ROLES,
  audit: ['ADMIN', 'FINANCE'], reports: ['ADMIN', 'FINANCE'], erp: ['ADMIN', 'FINANCE'],
  integrations: ['ADMIN', 'FINANCE', 'LOGISTICS'], notifications: STAFF_ROLES,
  catalog: ['ADMIN'], settings: ['ADMIN'], users: ['ADMIN'], invoices: ['ADMIN', 'FINANCE'],
  editCustomers: ['ADMIN', 'CALL_CENTER_AGENT', 'STORE_MANAGER', 'STORE_EMPLOYEE'],
  editInventory: ['ADMIN', 'LOGISTICS', 'STORE_MANAGER', 'STORE_EMPLOYEE'],
  editShipments: ['ADMIN', 'LOGISTICS', 'STORE_MANAGER'],
  editNotifications: ['ADMIN', 'CALL_CENTER_AGENT', 'STORE_MANAGER', 'STORE_EMPLOYEE'],
  editIntegrations: ['ADMIN'],
} satisfies Record<string, readonly StaffRole[]>
export type Permission = keyof typeof PERMISSIONS
export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  return roles.some(role => (PERMISSIONS[permission] as readonly string[]).includes(role))
}
const ROUTES: Record<string, Permission> = {
  dashboard: 'dashboard', ordenes: 'orders', clientes: 'customers', incidencias: 'incidents', devoluciones: 'incidents',
  ubicaciones: 'locations', traslados: 'transfers', inventario: 'inventory', reservas: 'reservations', logistica: 'logistics', seguimiento: 'logistics',
  auditoria: 'audit', reportes: 'reports', erp: 'erp', integraciones: 'integrations',
  notificaciones: 'notifications', catalogo: 'catalog', configuracion: 'settings', usuarios: 'users', facturas: 'invoices',
}
export function canAccessStaffPath(roles: readonly string[], path: string): boolean {
  const segment = path.split('/')[2]
  if(segment === 'ventas' || /^\/administracion\/clientes\/[^/]+\/venta$/.test(path)) return hasPermission(roles,'editCustomers')
  if (/^\/administracion\/ordenes\/[^/]+\/pago$/.test(path)) return hasPermission(roles, 'editCustomers')
  if (path === '/administracion' || path === '/administracion/') return roles.some(role => (STAFF_ROLES as readonly string[]).includes(role))
  return path.startsWith('/administracion/') && !!ROUTES[segment] && hasPermission(roles, ROUTES[segment])
}
export function staffHome(roles: readonly string[]): string {
  if (roles.includes('ADMIN')) return '/administracion/configuracion'
  return hasPermission(roles, 'dashboard') ? '/administracion/dashboard' : '/administracion/ordenes'
}
