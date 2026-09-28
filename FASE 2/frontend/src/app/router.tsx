import { Navigate, Route, Routes } from 'react-router-dom'
import { CatalogListPage } from '../features/catalogo/pages/CatalogListPage'
import { ProductDetailPage } from '../features/catalogo/pages/ProductDetailPage'
import { PromocionesPage } from '../features/catalogo/pages/PromocionesPage'
import { CartPage } from '../features/carrito/pages/CartPage'
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage'
import { OrderStatusPage } from '../features/orden/pages/OrderStatusPage'
import { PaymentPage } from '../features/pago/pages/PaymentPage'
import { OrdersListPage } from '../features/orden/pages/OrdersListPage'
import { NotificacionesPlaceholderPage } from '../features/notificaciones/pages/NotificacionesPlaceholderPage'
import { PerfilPlaceholderPage } from '../features/perfil/pages/PerfilPlaceholderPage'
import { LoginPage } from '../features/backoffice/auth/pages/LoginPage'
import { DashboardPage } from '../features/backoffice/dashboard/pages/DashboardPage'
import { ReportesPage } from '../features/backoffice/reportes/pages/ReportesPage'
import { OrdenesPage } from '../features/backoffice/ordenes/pages/OrdenesPage'
import { IncidenciasPage } from '../features/backoffice/incidencias/pages/IncidenciasPage'
import { DevolucionesPage } from '../features/backoffice/incidencias/pages/DevolucionesPage'
import { InventarioPage } from '../features/backoffice/inventario/pages/InventarioPage'
import { ReservasPage } from '../features/backoffice/reservas/pages/ReservasPage'
import { LogisticaPage } from '../features/backoffice/logistica/pages/LogisticaPage'
import { SeguimientoPage } from '../features/backoffice/logistica/pages/SeguimientoPage'
import { ClientesPage } from '../features/backoffice/clientes/pages/ClientesPage'
import { ClienteDetallePage } from '../features/backoffice/clientes/pages/ClienteDetallePage'
import { AuditoriaPage } from '../features/backoffice/auditoria/pages/AuditoriaPage'
import { ConfiguracionPage } from '../features/backoffice/configuracion/pages/ConfiguracionPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/catalogo" replace />} />
      <Route path="/catalogo" element={<CatalogListPage />} />
      <Route path="/productos/:id" element={<ProductDetailPage />} />
      <Route path="/promociones" element={<PromocionesPage />} />
      <Route path="/carrito" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/ordenes/:id" element={<OrderStatusPage />} />
      <Route path="/ordenes/:id/pago" element={<PaymentPage />} />
      <Route path="/mis-ordenes" element={<OrdersListPage />} />
      <Route path="/notificaciones" element={<NotificacionesPlaceholderPage />} />
      <Route path="/perfil" element={<PerfilPlaceholderPage />} />
      <Route path="/administracion/login" element={<LoginPage />} />
      <Route path="/administracion" element={<Navigate to="/administracion/dashboard" replace />} />
      <Route path="/administracion/dashboard" element={<DashboardPage />} />
      <Route path="/administracion/ordenes" element={<OrdenesPage />} />
      <Route path="/administracion/incidencias" element={<IncidenciasPage />} />
      <Route path="/administracion/devoluciones" element={<DevolucionesPage />} />
      <Route path="/administracion/inventario" element={<InventarioPage />} />
      <Route path="/administracion/reservas" element={<ReservasPage />} />
      <Route path="/administracion/logistica" element={<LogisticaPage />} />
      <Route path="/administracion/seguimiento" element={<SeguimientoPage />} />
      <Route path="/administracion/clientes" element={<ClientesPage />} />
      <Route path="/administracion/clientes/:id" element={<ClienteDetallePage />} />
      <Route path="/administracion/auditoria" element={<AuditoriaPage />} />
      <Route path="/administracion/reportes" element={<ReportesPage />} />
      <Route path="/administracion/configuracion" element={<ConfiguracionPage />} />
    </Routes>
  )
}
