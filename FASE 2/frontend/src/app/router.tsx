import { Navigate, Route, Routes } from 'react-router-dom'
import { CatalogListPage } from '../features/catalogo/pages/CatalogListPage'
import { ProductDetailPage } from '../features/catalogo/pages/ProductDetailPage'
import { PromocionesPage } from '../features/catalogo/pages/PromocionesPage'
import { CartPage } from '../features/carrito/pages/CartPage'
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage'
import { OrderStatusPage } from '../features/orden/pages/OrderStatusPage'
import { PaymentPage } from '../features/pago/pages/PaymentPage'
import { OrdenesPlaceholderPage } from '../features/orden/pages/OrdenesPlaceholderPage'
import { NotificacionesPlaceholderPage } from '../features/notificaciones/pages/NotificacionesPlaceholderPage'
import { PerfilPlaceholderPage } from '../features/perfil/pages/PerfilPlaceholderPage'

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
      <Route path="/mis-ordenes" element={<OrdenesPlaceholderPage />} />
      <Route path="/notificaciones" element={<NotificacionesPlaceholderPage />} />
      <Route path="/perfil" element={<PerfilPlaceholderPage />} />
    </Routes>
  )
}
