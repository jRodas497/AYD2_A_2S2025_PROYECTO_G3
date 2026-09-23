# Checklist de verificación por pantalla (PB-032 — parte Frontend 1)

Plantilla por pantalla: marcar cada RF de su historia y el RNF aplicable antes de dar la historia por terminada.

## Catálogo (`/catalogo`) — PB-001, PB-035, PB-036

- [x] Cubre línea blanca, electrónica, ropa y calzado (RF PB-001.1)
- [x] El precio mostrado incluye promociones vigentes (RF PB-001.2 / PB-036.2)
- [x] La búsqueda filtra por nombre y por categoría (RF PB-035.1)
- [x] RNF: la carga de productos no bloquea el resto de la pantalla (buscador y filtros siguen interactivos mientras `cargando` es true)

## Detalle de producto (`/productos/:id`) — PB-035

- [x] Muestra descripción, precio vigente y disponibilidad (RF PB-035.2)
- [x] Desde el detalle se puede agregar al carrito (RF PB-035.3)

## Promociones (`/promociones`) — PB-036

- [x] Las promociones vigentes se listan (RF PB-036.1)

## Carrito (`/carrito`) — PB-002, PB-003

- [x] Agregar un producto verifica disponibilidad en tiempo real antes de reservar (RF PB-002.3)
- [x] Si la reserva falla, se muestra el motivo y una sugerencia (RF PB-003.1, PB-003.2)
- [x] El resto del carrito no se ve afectado cuando un producto falla al agregarse (RF PB-003.3)
- [x] El carrito persiste tras recargar la página, dentro del mismo navegador (simulación local de "el carrito es del cliente" — pendiente de validar cross-device con backend real)

## Identificación del cliente (transversal) — PB-009

- [x] El carrito queda asociado al cliente identificado, no al canal/dispositivo (RF PB-009.3 — vía `CustomerContext`)
- [x] Existe un mecanismo de reidentificación accesible en todo momento (RF PB-009.2 — control "¿No eres tú?" en la sidebar + modal bloqueante)
- [ ] Detección automática de sesión no reconocible al cambiar de canal (RF PB-009.2, parcial) — el mock la simula manualmente; no hay canales reales que forzar el escenario todavía.

## Checkout (`/checkout`) — PB-004

- [x] Permite elegir centro de distribución, tienda o recogida como método de entrega (RF PB-004.1)
- [x] Al confirmar, la orden pasa a estado "pendiente de pago" (RF PB-004.2)
- [x] Se dispara el flujo hacia la orden creada (RF PB-004.3) — el flujo de pago en sí es PB-010 (siguiente entrega)
- [x] Un carrito vacío no permite llegar a confirmar una compra sin productos

## Estado de orden (`/ordenes/:id`) — base para PB-025

- [x] Muestra número de orden, ítems, total, método de entrega y estado
- [x] Un id de orden inexistente responde con mensaje claro, sin exponer otras órdenes

## Hallazgos pendientes de este plan

- La sugerencia de producto/tienda alternativa en PB-003 es un texto fijo de demo — falta contrato real del backend para dato dinámico (ver `docs/contratos-api/catalog-service.md`).
- La reidentificación (PB-009) se dispara manualmente desde la sidebar, no automáticamente al detectar una sesión perdida — falta que Customer Service defina el mecanismo real de detección (ver `docs/contratos-api/order-checkout-service.md`).
- `/ordenes/:id` hoy solo muestra lo que devuelve la creación de la orden — la vista consolidada completa (pago, despacho, entrega, incidencias) es PB-025, todavía no implementada.
