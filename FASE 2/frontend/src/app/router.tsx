import { CatalogAdminPage } from '../features/backoffice/catalogo/CatalogAdminPage'
import { ErpPage } from '../features/backoffice/erp/ErpPage'
import { UsuariosPage } from '../features/backoffice/usuarios/UsuariosPage'
import { VentaAsistidaPage } from '../features/backoffice/ventas/VentaAsistidaPage'
import { RecuperarCuentaPage } from '../features/cliente/pages/RecuperarCuentaPage'
import { CustomerGate } from '../shared/auth/CustomerGate'
import { staffHome } from '../shared/auth/accessPolicy'
import { useAuth } from '../shared/context/AuthContext'
import { StaffGate } from '../shared/auth/StaffGate'
import { CreditPage } from '../features/credito/CreditPage'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CustomerLoginPage } from '../features/cliente/pages/CustomerLoginPage'
import { CatalogListPage } from '../features/catalogo/pages/CatalogListPage'
import { ProductDetailPage } from '../features/catalogo/pages/ProductDetailPage'
import { PromocionesPage } from '../features/catalogo/pages/PromocionesPage'
import { CartPage } from '../features/carrito/pages/CartPage'
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage'
import { OrderStatusPage } from '../features/orden/pages/OrderStatusPage'
import { PaymentPage } from '../features/pago/pages/PaymentPage'
import { OrdersListPage } from '../features/orden/pages/OrdersListPage'
import { NotificacionesPage } from '../features/notificaciones/pages/NotificacionesPage'
import { PerfilPage } from '../features/perfil/pages/PerfilPage'
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
import { IntegracionesPage } from '../features/backoffice/integraciones/pages/IntegracionesPage'
import { NotificacionesAdminPage } from '../features/backoffice/notificaciones/pages/NotificacionesAdminPage'
import { FacturasPage } from '../features/backoffice/facturas/pages/FacturasPage'

function StaffHome() {
  const { session } = useAuth()
  return <Navigate to={staffHome(session?.roles ?? [])} replace />
}
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/catalogo" replace />} />
      <Route path="/ingresar" element={<CustomerLoginPage />} />
      <Route path="/recuperar" element={<RecuperarCuentaPage />} />
      <Route path="/catalogo" element={<CatalogListPage />} />
      <Route path="/productos/:id" element={<ProductDetailPage />} />
      <Route path="/promociones" element={<PromocionesPage />} />
      <Route path="/carrito" element={<CustomerGate><CartPage /></CustomerGate>} />
      <Route path="/checkout" element={<CustomerGate><CheckoutPage /></CustomerGate>} />
      <Route path="/ordenes/:id" element={<CustomerGate><OrderStatusPage /></CustomerGate>} />
      <Route path="/ordenes/:id/pago" element={<CustomerGate><PaymentPage /></CustomerGate>} />
      <Route path="/mis-ordenes" element={<CustomerGate><OrdersListPage /></CustomerGate>} />
      <Route path="/notificaciones" element={<CustomerGate><NotificacionesPage /></CustomerGate>} />
      <Route path="/credito" element={<CustomerGate><CreditPage /></CustomerGate>} />
      <Route path="/perfil" element={<CustomerGate><PerfilPage /></CustomerGate>} />
      <Route path="/administracion/login" element={<LoginPage />} />
      <Route path="/administracion" element={<StaffGate><StaffHome /></StaffGate>} />
      <Route path="/administracion/dashboard" element={<StaffGate><DashboardPage /></StaffGate>} />
      <Route path="/administracion/ordenes/:id/pago" element={<StaffGate><PaymentPage /></StaffGate>} />
      <Route path="/administracion/ordenes/:id" element={<StaffGate><OrderStatusPage /></StaffGate>} />
      <Route path="/administracion/ordenes" element={<StaffGate><OrdenesPage /></StaffGate>} />
      <Route path="/administracion/incidencias" element={<StaffGate><IncidenciasPage /></StaffGate>} />
      <Route path="/administracion/devoluciones" element={<StaffGate><DevolucionesPage /></StaffGate>} />
      <Route path="/administracion/inventario" element={<StaffGate><InventarioPage /></StaffGate>} />
      <Route path="/administracion/reservas" element={<StaffGate><ReservasPage /></StaffGate>} />
      <Route path="/administracion/logistica" element={<StaffGate><LogisticaPage /></StaffGate>} />
      <Route path="/administracion/seguimiento" element={<StaffGate><SeguimientoPage /></StaffGate>} />
      <Route path="/administracion/clientes" element={<StaffGate><ClientesPage /></StaffGate>} />
      <Route path="/administracion/clientes/:id" element={<StaffGate><ClienteDetallePage /></StaffGate>} />
      <Route path="/administracion/clientes/:id/venta" element={<StaffGate><VentaAsistidaPage /></StaffGate>} />
      <Route path="/administracion/ventas/nueva" element={<StaffGate><VentaAsistidaPage /></StaffGate>} />
      <Route path="/administracion/auditoria" element={<StaffGate><AuditoriaPage /></StaffGate>} />
      <Route path="/administracion/reportes" element={<StaffGate><ReportesPage /></StaffGate>} />
      <Route path="/administracion/usuarios" element={<StaffGate><UsuariosPage /></StaffGate>} />
      <Route path="/administracion/configuracion" element={<StaffGate><ConfiguracionPage /></StaffGate>} />
      <Route path="/administracion/catalogo" element={<StaffGate><CatalogAdminPage /></StaffGate>} />
      <Route path="/administracion/erp" element={<StaffGate><ErpPage /></StaffGate>} />
      <Route path="/administracion/integraciones" element={<StaffGate><IntegracionesPage /></StaffGate>} />
      <Route path="/administracion/notificaciones" element={<StaffGate><NotificacionesAdminPage /></StaffGate>} />
      <Route path="/administracion/facturas" element={<StaffGate><FacturasPage /></StaffGate>} />
    </Routes>
  )
}
