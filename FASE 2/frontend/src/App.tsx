import { AppLayout } from './shared/layout/AppLayout'
import { AppRouter } from './app/router'
import { CustomerProvider } from './shared/context/CustomerContext'
import { CartProvider } from './features/carrito/context/CartContext'
import { ReidentifyPrompt } from './shared/components/ReidentifyPrompt'

function App() {
  return (
    <CustomerProvider>
      <CartProvider>
        <AppLayout>
          <AppRouter />
        </AppLayout>
        <ReidentifyPrompt />
      </CartProvider>
    </CustomerProvider>
  )
}

export default App
