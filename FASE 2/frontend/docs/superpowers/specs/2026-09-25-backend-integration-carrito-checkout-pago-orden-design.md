# Integración con backend real — Carrito, Checkout, Pago y Orden — Diseño

## Contexto

Catálogo y Clientes ya están conectados al backend real (`FASE 2/backend`, ver spec `2026-09-25-backend-integration-catalogo-clientes-design.md`). Esta spec cubre la siguiente porción: `carrito`, `checkout`, `pago` y `orden`, hoy 100% mock. A diferencia de la fase anterior, el backend real tiene capacidades genuinamente más limitadas que lo que el mock asumía en varios puntos — no es solo "cambiar mock por http", hay comportamiento de UI que cambia. Las decisiones de fondo ya se acordaron con el usuario (ver resumen abajo); esta spec las deja documentadas con precisión para quien escriba el plan.

Decisiones ya tomadas con el usuario:
1. **Carrito real, sin editar.** El backend solo soporta agregar/incrementar (`POST /api/customers/{id}/cart/items`) — no hay endpoint para bajar cantidad ni eliminar un ítem. Se conecta carrito al backend real y se quitan esos controles de la UI.
2. **"Mis órdenes" con índice local + datos en vivo.** El backend no tiene endpoint para listar las órdenes de un cliente. El frontend mantiene en `localStorage` los ids de las órdenes que ese cliente creó (al hacer checkout) y consulta el estado real de cada una.
3. **Checkout con dirección real.** El backend solo pide `deliveryAddress` (texto libre) — se reemplaza el selector de "método de entrega" (centro de distribución/tienda/recogida) por un campo de texto obligatorio.
4. **Detalle de ítems por snapshot local.** `GET /api/orders/{id}` no trae line items, solo el total. Al confirmar el checkout se guarda localmente una copia de qué productos tenía el carrito, solo para mostrarla; estado y total siguen viniendo en vivo del backend.
5. **Límite de reintentos de pago (PB-014) como regla de frontend sobre datos reales.** El backend no tiene concepto de "fallido definitivo": un solo rechazo ya deja la orden en `PAYMENT_FAILED`, reintentable sin límite. El frontend cuenta los rechazos reales vía `GET /api/orders/{orderId}/payments` y aplica el límite de 3 que ya exige PB-014, sin depender del estado de la orden para eso.

## Fuera de alcance (explícito)

- Dashboard/Reportes de administración — siguen 100% mock, sin cambios.
- Autenticación/JWT — sigue fuera de alcance (no la necesita ningún endpoint de esta fase).
- Facturación, logística, notificaciones, incidencias, auditoría — la orden los refleja pasivamente (estado, `trackingNumber`) pero esta fase no agrega pantallas nuevas para ellos.
- El simulador de terceros (`/api/simulation`) no se integra en el frontend — es una herramienta de demo que se opera por fuera (Postman/curl) para forzar escenarios de fallo; se documenta cómo usarla en el checklist, no se construye UI para ella.
- Reintento manual de un pago "en proceso" — sigue resolviéndose solo, vía sondeo, igual que hoy.

## Carrito (`src/features/carrito/`)

**`CartRepository` cambia de interfaz.** Hoy es `{getCart(customerId), saveCart(customerId, cart)}`, pensado para un cliente que reescribe el carrito completo. El backend real no tiene un "guardar carrito completo": solo lectura y agregar/incrementar. Nueva interfaz:

```ts
export interface CartRepository {
  getCart(customerId: string): Promise<Cart>
  addItem(customerId: string, productId: string, cantidad: number): Promise<Cart>
}
```

`mockCartRepository` se reescribe para implementar esta misma interfaz (su `addItem` hace merge por `productId` incrementando cantidad, igual que hará el backend real) — se exporta con `satisfies CartRepository` en vez de una anotación de tipo directa, para poder conservar cualquier utilidad interna que ya no es parte de la interfaz pública sin que TypeScript la rechace por "excess property". `cartRepository.mock.test.ts` se actualiza a probar `addItem` en vez de `saveCart`.

**Nuevo archivo `src/features/carrito/api/cartRepository.http.ts`:**
- `getCart(customerId)`: `GET /api/customers/{id}/cart`. Responde `{cartId, status, channel, items: [{productId, quantity}]}` (`cartId`/`status`/`channel` pueden venir `null` si no hay carrito activo — se trata igual que carrito vacío). Cada item del backend no trae nombre/sku/precio — se enriquece llamando a `httpCatalogRepository.getById(String(productId))` para cada uno, en paralelo (`Promise.all`), con aislamiento por producto (si un producto ya no existe o falla su consulta, se omite ese ítem del carrito en vez de romper la carga completa — mismo patrón que ya usa `catalogRepository.http.ts` para disponibilidad). Mapea a `CartItem` usando `nombre`, `sku`, `precio.final` del producto.
- `addItem(customerId, productId, cantidad)`: `POST /api/customers/{id}/cart/items` con body `{ productId: Number(productId), quantity: cantidad, channel: 'WEB' }`. `404` si el cliente o el producto no existen (o el producto está inactivo) — se traduce a un `Error` con mensaje claro para que el llamador lo muestre. La respuesta ya trae el carrito completo actualizado (`{cartId, status, channel, items}`), pero sin datos de producto — se reusa la misma lógica de enriquecimiento que `getCart` (extraída a una función privada compartida) para devolver un `Cart` completo.

**`useCarrito.ts`:**
- `agregarProducto(producto, cantidad)`: sigue verificando disponibilidad con `httpCatalogRepository.getById` antes de agregar (ya lo hace hoy), y ahora llama a `httpCartRepository.addItem(customer.id, producto.id, cantidad)`, usando el `Cart` que devuelve la llamada como nuevo estado (ya no arma el array de items a mano).
- `actualizarCantidad` y `eliminarItem` se eliminan — no tienen contraparte en el backend real. `vaciarCarrito` se elimina también: ya no hace falta, el backend convierte el carrito automáticamente al hacer checkout (ver sección Checkout).
- Para incrementar la cantidad de un ítem ya en el carrito desde `CartPage`, se agrega `incrementarItem(productId)` que llama a `addItem(customer.id, productId, 1)` — misma llamada que agregar desde catálogo, sin necesidad de re-verificar disponibilidad (el backend ya valida existencia al agregar y devuelve 409/404 si no hay stock).

**`CartContext.tsx`:** cambia su import de `mockCartRepository` a `httpCartRepository`; su forma (`{cart, cargando, setCart}`) ya no calza porque no existe un "guardar carrito completo" — se reduce a `{cart, cargando, recargar}` donde `recargar()` vuelve a pedir `getCart` (usado tras `addItem` si se prefiere fuente de verdad del servidor, aunque el valor devuelto por `addItem` ya sirve como actualización optimista sin round-trip extra). El contexto expone también una función interna que `useCarrito` usa para aplicar el `Cart` devuelto por `addItem` directamente al estado, evitando una llamada de red adicional.

**`CartPage.tsx`:**
- Se quita el `QuantityStepper` (decrementar/eliminar) de cada línea; se reemplaza por el texto de la cantidad actual y un botón "+" que llama a `incrementarItem`.
- Se quita el botón "Eliminar".
- Se agrega una nota breve, visible una sola vez en la pantalla (no por ítem), explicando que por ahora solo se puede agregar más — no se resta ni se quita ("Para quitar productos o reducir cantidades, contacta a servicio al cliente" o equivalente, tono de la interfaz, no de disculpa).
- `ProductDetailPage.tsx` no cambia: su `QuantityStepper` es para elegir cantidad **antes** de agregar (estado local propio), no toca el carrito directamente.

## Checkout (`src/features/checkout/`)

**`CheckoutPage.tsx`:**
- El bloque de 3 radios "Método de entrega" se reemplaza por un `<input type="text">` obligatorio, etiqueta "Dirección de entrega", con validación mínima (no vacío) antes de habilitar "Confirmar compra".
- `handleConfirmar`:
  1. Captura el snapshot de ítems actuales (`cart.items`, ya con nombre/sku/precio) antes de cualquier llamada de red.
  2. Llama a `orderRepository.createOrder({ customerId: customer.id, direccionEntrega })`.
  3. Con el `Order` resultante: guarda el snapshot en `localStorage` bajo una clave por orden (ver sección Orden), registra el id en el índice local de órdenes del cliente, y resetea el estado del carrito en memoria a `EMPTY_CART` (optimista — el backend ya convirtió el carrito activo al crear la orden, no hace falta pedirlo de nuevo).
  4. Navega a `/ordenes/{id}`.
- Errores de checkout (`400` carrito vacío/sin carrito, `409` producto inactivo o sin stock) se muestran como texto en la pantalla, sin bloquear la posibilidad de volver al carrito.

## Orden (`src/features/orden/`)

**`types.ts`:**
```ts
export type EstadoOrden =
  | 'pendiente_pago'   // PENDING_PAYMENT
  | 'pago_en_proceso'  // PAYMENT_IN_PROGRESS
  | 'pago_fallido'     // PAYMENT_FAILED
  | 'pagada'           // PAID
  | 'facturada'        // INVOICED
  | 'en_despacho'      // IN_DISPATCH
  | 'entregada'        // DELIVERED
  | 'cancelada'        // CANCELLED
  | 'devuelta'         // RETURNED
```
`Order` cambia su campo de entrega: `metodoEntrega: MetodoEntrega` se reemplaza por `direccionEntrega: string`. El campo `items: CartItem[]` se mantiene en el tipo pero documentado como "vacío salvo que exista snapshot local" — lo llena una función aparte, no el repositorio (ver abajo). Se agrega `trackingNumber?: string` (viene de `GET /api/orders/{id}`, `null` hasta que haya guía).

`CrearOrdenInput` cambia de `{customerId, items, metodoEntrega}` a `{customerId, items, direccionEntrega}` (se conserva `items` en el input porque el snapshot local se arma a partir de ahí, aunque el backend no los reciba en el body — el repositorio los usa solo para el snapshot, no los manda en la petición HTTP). `MetodoEntrega` y `ETIQUETA_ENTREGA` (en `OrderStatusPage.tsx`) se eliminan, ya no tienen uso.

Este cambio de tipos es compartido por mock y http: `mockOrderRepository.createOrder` también pasa a recibir `direccionEntrega` y a guardarla en el `Order` que produce (en vez de `metodoEntrega`), y `orderRepository.mock.test.ts` se actualiza para usar el campo nuevo en sus fixtures — el mock no necesita snapshot ni índice local (ya persiste todo, items incluidos, en su propio `localStorage`).

**`estadoLabels.ts`:** `ETIQUETA_ESTADO` gana las 5 entradas nuevas:
- `facturada`: texto "Factura generada", tono `info`.
- `en_despacho`: texto "En despacho", tono `info`.
- `entregada`: texto "Entregada", tono `ok`.
- `cancelada`: texto "Cancelada", tono `falla`.
- `devuelta`: texto "Devuelta", tono `alerta`.

Se agrega `ESTADOS_TERMINALES: EstadoOrden[] = ['entregada', 'cancelada', 'devuelta']`, usado por `OrderStatusPage` para dejar de sondear.

**Nuevo archivo `src/features/orden/api/orderIndex.ts`** — índice local de órdenes por cliente, sin red:
```ts
export function registrarOrden(customerId: string, orderId: string): void
export function listarIdsOrdenes(customerId: string): string[]
```
Clave de `localStorage`: `sgo-order-ids-<customerId>`. `registrarOrden` agrega el id sin duplicar (si ya está, no lo mueve de posición — el orden de despliegue lo decide `listOrders` por fecha real del backend, no por orden de inserción local).

**Nuevo archivo `src/features/orden/api/orderItemsSnapshot.ts`** — snapshot local del detalle de la orden (ítems y dirección, lo que el backend no devuelve en `GET /api/orders/{id}`):
```ts
export interface OrderSnapshot {
  items: CartItem[]
  direccionEntrega: string
}
export function guardarSnapshot(orderId: string, snapshot: OrderSnapshot): void
export function obtenerSnapshot(orderId: string): OrderSnapshot | null
```
Clave: `sgo-order-items-<orderId>`. `obtenerSnapshot` devuelve `null` cuando no hay snapshot guardado (orden vista desde otro navegador, o `localStorage` limpiado) — la UI debe distinguir ese caso de "orden sin productos" (no debería pasar).

**`OrderRepository`** conserva su interfaz actual (`createOrder`, `getOrder`, `updateEstado`, `listOrders`) — no se reduce, a diferencia de `CartRepository`, porque cambiar la interfaz aquí obligaría a decisiones distintas en cada consumidor; en cambio, las capacidades que el backend real no tiene se resuelven **dentro** de `orderRepository.http.ts`:
- `createOrder(input)`: `POST /api/orders/checkout` con `{ customerId: Number(input.customerId), deliveryAddress: input.direccionEntrega }`. Mapea la respuesta (`{id, cartId, customerId, channel, status, total, deliveryAddress, createdAt, updatedAt}`) a `Order` (`estado` mapeado desde `status` vía una tabla backend→frontend). Antes de devolver, llama a `guardarSnapshot(String(id), { items: input.items, direccionEntrega: input.direccionEntrega })` y `registrarOrden(input.customerId, String(id))` — **dentro del repositorio**, no en `CheckoutPage`, para que quien use `createOrder` (cualquier página futura) obtenga el mismo comportamiento sin repetir lógica.
- `getOrder(id)`: `GET /api/orders/{id}`. `404` → `null`. Mapea `status` con la misma tabla backend→frontend. `items` y `direccionEntrega` no vienen en este endpoint (el backend solo los da en la respuesta de checkout) — se llenan con `obtenerSnapshot(id)`: si existe, `items: snapshot.items, direccionEntrega: snapshot.direccionEntrega`; si no, `items: [], direccionEntrega: ''` (la UI ya sabe distinguir "sin snapshot" mostrando un aviso en vez del texto vacío).
- `listOrders(customerId)`: usa `listarIdsOrdenes(customerId)`, llama `getOrder` para cada id en paralelo, descarta `null` (orden borrada o inaccesible), ordena por `creadaEn` descendente. Ningún cambio de firma — el resto del código (`OrdersListPage`) sigue llamando `orderRepository.listOrders(customer.id)` exactamente igual que hoy.
- `updateEstado(id, estado)`: lanza `new Error('El estado de la orden lo controla el backend real; no se puede forzar desde el frontend')`. No debería invocarse nunca contra el repositorio HTTP (el flujo de pago real no lo necesita — ver sección Pago); existe solo para satisfacer la interfaz y fallar ruidosamente si algo llega a llamarlo por error, en vez de fallar en silencio.

**`OrdersListPage.tsx`:** sin cambios de código — sigue llamando a `orderRepository.listOrders`, que ahora resuelve mock o http según cuál esté activo.

**`OrderStatusPage.tsx`:**
- Muestra `orden.direccionEntrega` en vez de `ETIQUETA_ENTREGA[orden.metodoEntrega]`.
- El `setInterval` de sondeo se detiene (`clearInterval`) apenas `orden.estado` esté en `ESTADOS_TERMINALES`.
- Si `orden.trackingNumber` existe, se muestra ("Guía de envío: `<trackingNumber>`").
- Los mensajes de transición (`MENSAJE_TRANSICION`) ganan entradas para `facturada`, `en_despacho`, `entregada`, `cancelada`, `devuelta`.
- El bloque que hoy muestra "se agotaron los intentos de cobro" cuando `orden.estado === 'pago_fallido'` se quita de `OrderStatusPage` — `pago_fallido` ahora puede ser transitorio (retomable). El botón "Pagar ahora" (hoy visible solo si `orden.estado === 'pendiente_pago'`) pasa a mostrarse también si `orden.estado === 'pago_fallido'`, enlazando igual a `/ordenes/{id}/pago` — es esa pantalla la que decide, por el conteo real de intentos, si deja reintentar o muestra el dead-end definitivo (ver sección Pago). `OrderStatusPage` en `pago_fallido` solo muestra un texto neutro ("El pago no se pudo confirmar") junto al botón, sin asumir si es definitivo o no.

## Pago (`src/features/pago/`)

`MetodoPago` y `ResultadoCobro` no cambian de forma. Tabla de mapeo backend → frontend para `charge`:

| Backend `result` | Frontend `ResultadoCobro` |
|---|---|
| `APPROVED` | `aprobado` |
| `DECLINED` | `rechazado` |
| `TIMEOUT` | `en_proceso` |
| `ERROR` | `en_proceso` |

`MetodoPago` → backend `method`: `tarjeta→CARD`, `transferencia→TRANSFER`, `billetera→WALLET`.

**Nuevo archivo `src/features/pago/api/paymentRepository.http.ts`:**
- `charge(orderId, metodo, tarjeta?)`: `POST /api/orders/{orderId}/payments` con `{ method: MAPA_METODO[metodo], cardToken: generarTokenSimulado(), cardLast4: tarjeta?.ultimosDigitos }`. `generarTokenSimulado()` produce un valor tipo `tok_<random>` que nunca deriva del número real de tarjeta (el backend rechaza con `400` cualquier cosa que parezca un número de tarjeta) — simula el límite de un formulario de PayKlik real, que nunca entregaría el número en sí. Mapea la respuesta (`{orderId, attemptNumber, result, orderStatus, providerReference, latencyMs, message}`) a `PaymentAttempt`: `id` = `` `${orderId}-${attemptNumber}` ``, `resultado` según la tabla de arriba, `motivo` = `message` cuando no es `aprobado`, `fecha` = `new Date().toISOString()` (el backend no da timestamp en esta respuesta puntual — limitación conocida, documentada). No llama a `orderRepository.updateEstado` — el estado real ya quedó actualizado en el backend (`orderStatus` en la respuesta), el llamador debe releer la orden con `getOrder` si lo necesita, igual que ya hace `PaymentPage` hoy tras un rechazo.
- `countIntentosFallidos(orderId)`: `GET /api/orders/{orderId}/payments`, cuenta los elementos con `result === 'DECLINED'`.
- `maxIntentosFallidos = 3` (constante, igual que en el mock — es una regla de negocio de frontend sobre el historial real, no algo que el backend imponga).

**`mockPaymentRepository`** se simplifica para reflejar lo que se aprendió del backend real: un rechazo deja la orden en `pago_fallido` de inmediato (ya no hay una fase intermedia de "vuelve a pendiente_pago hasta la 3ra falla") — el `countIntentosFallidos`/`maxIntentosFallidos` siguen existiendo para que `PaymentPage` decida cuándo es definitivo, igual que contra el backend real. Esto es una corrección deliberada del mock para que ambos caminos (mock/http) se comporten igual ante quien los consume — se actualiza `paymentRepository.mock.test.ts` en consecuencia.

**`PaymentPage.tsx`:**
- Al montar, además de cargar la orden, llama `paymentRepository.countIntentosFallidos(id)` y guarda el resultado en estado (`intentosFallidos`) — así un refresh después de la 3ra falla sigue mostrando el dead-end, sin depender de que `orden.estado` siga siendo `pago_fallido` en ese momento puntual.
- La pantalla de "fallido definitivamente" se muestra cuando `intentosFallidos >= maxIntentosFallidos`, no cuando `orden.estado === 'pago_fallido'` (ese estado ahora puede ser transitorio y reintentable).
- Tras un rechazo, se vuelve a pedir `countIntentosFallidos` (no solo releer la orden) para decidir si mostrar "puedes reintentar" o el dead-end.

## Testing

Mismo enfoque que la fase anterior: Vitest puro sobre repositorios, `vi.spyOn(globalThis, 'fetch')` para los `.http.ts`, sin librerías de mocking de red nuevas.

- `cartRepository.mock.test.ts`: actualizado para `addItem` (merge/incremento) en vez de `saveCart`.
- `cartRepository.http.test.ts` (nuevo): `getCart` enriquece items con catálogo y omite productos que fallan; `addItem` manda el body correcto y mapea la respuesta.
- `orderRepository.http.test.ts` (nuevo): `createOrder` manda `deliveryAddress`, guarda snapshot e índice; `getOrder` mapea los 9 estados y usa el snapshot para `items`; `listOrders` usa el índice local; `updateEstado` lanza.
- `orderIndex.test.ts` / `orderItemsSnapshot.test.ts` (nuevos): lógica pura de `localStorage`, sin red.
- `paymentRepository.mock.test.ts`: actualizado para el nuevo comportamiento (rechazo inmediato a `pago_fallido`, sin fase intermedia).
- `paymentRepository.http.test.ts` (nuevo): `charge` mapea los 4 resultados del backend a los 3 del frontend; `countIntentosFallidos` cuenta solo `DECLINED`.

## Documentación

- `docs/contratos-api/order-checkout-service.md` y `docs/contratos-api/payment-service.md` se reescriben igual que se hizo con `catalog-service.md`: contrato real observado, ya no "asumido vía BFF".
- `docs/checklist-verificacion.md` gana una sección "Integración real — Carrito, Checkout, Pago y Órdenes", y se marcan como no cumplidas contra el backend real las RF que cambiaron: PB-004.1 (método de entrega → dirección de texto libre) y la edición de carrito (bajar cantidad/eliminar) de la sección Carrito.
- Se documenta cómo forzar los escenarios de fallo con `PUT /api/simulation/{provider}` (PayKlik `REJECT`/`DOWN`, etc.) para poder demostrar rechazo/timeout manualmente, ya que las tarjetas "mágicas" del mock (`0000`, `1111`) no existen contra el backend real.
