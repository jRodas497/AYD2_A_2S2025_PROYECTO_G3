import { AppLayout } from './shared/layout/AppLayout'
import { AppRouter } from './app/router'
import { CustomerProvider } from './shared/context/CustomerContext'
import { CartProvider } from './features/carrito/context/CartContext'

function App() {
  return (
    <CustomerProvider>
      <CartProvider>
        <AppLayout>
          <AppRouter />
        </AppLayout>
      </CartProvider>
    </CustomerProvider>
  )
}

export default App
