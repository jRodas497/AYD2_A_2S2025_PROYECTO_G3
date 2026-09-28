import { AppLayout } from './shared/layout/AppLayout'
import { AppRouter } from './app/router'
import { CustomerProvider } from './shared/context/CustomerContext'
import { AuthProvider } from './shared/context/AuthContext'
import { CartProvider } from './features/carrito/context/CartContext'
import { NotificationProvider } from './shared/notifications/NotificationContext'
import { ReidentifyPrompt } from './shared/components/ReidentifyPrompt'

function App() {
  return (
    <NotificationProvider>
      <CustomerProvider>
        <AuthProvider>
          <CartProvider>
            <AppLayout>
              <AppRouter />
            </AppLayout>
            <ReidentifyPrompt />
          </CartProvider>
        </AuthProvider>
      </CustomerProvider>
    </NotificationProvider>
  )
}

export default App
