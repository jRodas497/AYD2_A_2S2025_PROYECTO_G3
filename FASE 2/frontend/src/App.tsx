import { AppLayout } from './shared/layout/AppLayout'
import { AppRouter } from './app/router'
import { CustomerProvider } from './shared/context/CustomerContext'
import { CartProvider } from './features/carrito/context/CartContext'
import { NotificationProvider } from './shared/notifications/NotificationContext'
import { ReidentifyPrompt } from './shared/components/ReidentifyPrompt'

function App() {
  return (
    <NotificationProvider>
      <CustomerProvider>
        <CartProvider>
          <AppLayout>
            <AppRouter />
          </AppLayout>
          <ReidentifyPrompt />
        </CartProvider>
      </CustomerProvider>
    </NotificationProvider>
  )
}

export default App
