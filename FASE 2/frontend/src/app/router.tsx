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
import { DashboardPage } from '../features/backoffice/dashboard/pages/DashboardPage'
import { ReportesPage } from '../features/backoffice/reportes/pages/ReportesPage'
import { BackofficePlaceholderPage } from '../features/backoffice/placeholder/pages/BackofficePlaceholderPage'

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
      <Route path="/administracion" element={<Navigate to="/administracion/dashboard" replace />} />
      <Route path="/administracion/dashboard" element={<DashboardPage />} />
      <Route path="/administracion/ordenes" element={<BackofficePlaceholderPage titulo="Órdenes" />} />
      <Route path="/administracion/incidencias" element={<BackofficePlaceholderPage titulo="Incidencias" />} />
      <Route path="/administracion/devoluciones" element={<BackofficePlaceholderPage titulo="Devoluciones" />} />
      <Route path="/administracion/inventario" element={<BackofficePlaceholderPage titulo="Inventario" />} />
      <Route path="/administracion/reservas" element={<BackofficePlaceholderPage titulo="Reservas" />} />
      <Route path="/administracion/logistica" element={<BackofficePlaceholderPage titulo="Logística" />} />
      <Route path="/administracion/seguimiento" element={<BackofficePlaceholderPage titulo="Seguimiento" />} />
      <Route path="/administracion/clientes" element={<BackofficePlaceholderPage titulo="Clientes" />} />
      <Route path="/administracion/auditoria" element={<BackofficePlaceholderPage titulo="Auditoría" />} />
      <Route path="/administracion/reportes" element={<ReportesPage />} />
      <Route path="/administracion/configuracion" element={<BackofficePlaceholderPage titulo="Configuración" />} />
    </Routes>
  )
}
