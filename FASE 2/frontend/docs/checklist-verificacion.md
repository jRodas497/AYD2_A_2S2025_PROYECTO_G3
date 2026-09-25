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

## Pago (`/ordenes/:id/pago`) — PB-010, PB-013, PB-014

- [x] Ofrece tarjeta, transferencia y billetera digital (RF PB-010.1)
- [x] El resultado (aprobado, rechazado o en proceso) se refleja en la orden y se muestra al cliente (RF PB-010.3)
- [x] Un cobro rechazado devuelve la orden a "pendiente de pago" y muestra el motivo (RF PB-013.1, PB-013.2)
- [x] Se puede elegir un método de pago distinto sin recrear el carrito/la orden (RF PB-013.3)
- [x] Existe un máximo de reintentos fallidos; al agotarse, la orden queda "fallido definitivo" (RF PB-014.1, PB-014.2)
- [x] El formulario nunca conserva el número completo de tarjeta ni el CVV en su estado tras enviar el intento (DC-08/RC06)
- [x] RNF: mientras el pago está "en proceso", `OrderStatusPage` sondea sin bloquear la UI (no hay spinner de pantalla completa)

## Mis órdenes (`/mis-ordenes`) — adelanto de PB-038

- [x] Lista las órdenes del cliente, ordenadas por fecha (RF PB-038.1)
- [x] Cada una abre su estado consolidado (RF PB-038.2, vía `/ordenes/:id`)
- [x] Solo muestra órdenes del cliente identificado (RF PB-038.3)
- Nota: esta pantalla se adelantó desde Sprint 2 porque, sin ella, no había forma de recuperar una orden tras recargar la página — ver hallazgo corregido abajo. El resto de PB-038 (detalle ampliado) sigue pendiente.

## Dashboard y Reportes administrativos (`/administracion`, `/administracion/reportes`)

- [x] El Dashboard muestra tarjetas resumen, órdenes recientes e inventario con datos simulados (adelanto de administración, sin historia de backlog asignada todavía)
- [x] Reportes conecta el selector de período a datos reales del mock (antes era decorativo en frontend2)
- [x] Las 10 secciones restantes del menú de administración son placeholders "Próximamente", igual convención que Notificaciones/Perfil
- Nota: frontend2 (proyecto separado de un compañero de equipo) fue portado a este mismo codebase y eliminado del repo — ver `docs/contratos-api/backoffice-service.md` para el contrato asumido de estas dos pantallas.

## Hallazgos corregidos

- **Órdenes y pagos se perdían al recargar la página.** `orderRepository` y `paymentRepository` guardaban todo en un array en memoria (como `ChannelTabs`, pero peor: sin persistencia alguna). Ahora ambos usan `localStorage`, igual que el carrito. Una orden en "pago en proceso" además se resuelve sola al leerla si ya pasó el tiempo de espera — así, si recargas antes de que el temporizador en memoria dispare, no se queda "en proceso" para siempre.

## Integración real — Catálogo y Clientes

- [x] El catálogo (`/catalogo`, `/productos/:id`) llama al backend real (`GET /api/products`, `GET /api/products/{id}`, `GET /api/inventory/products/{id}/availability`) vía el proxy de Vite — ya no usa datos hardcodeados
- [x] Un error de red o del backend se muestra como texto en la pantalla, no como pantalla en blanco o error de consola
- [x] Un producto que ya no existe (`404`) se trata igual que "no encontrado" en el mock — no como error
- [x] Si la consulta de disponibilidad de un producto falla, el resto del catálogo se sigue mostrando
- [x] La identidad del cliente ahora es un registro real en la base de datos — se crea una vez por navegador (`localStorage: sgo-customer-id`) y "¿No eres tú?" persiste el cambio contra el backend
- Para levantar el backend real localmente: `cd "FASE 2" && docker compose up -d --build backend` (también levanta `db`). Ver `FASE 2/backend/API.md`.
- Nota: carrito, checkout, pago y órdenes siguen en mock — es la siguiente fase. El panel de administración (Dashboard/Reportes) sigue en mock porque el backend no tiene esos endpoints.

## Hallazgos pendientes de este plan

- La sugerencia de producto/tienda alternativa en PB-003 es un texto fijo de demo — falta contrato real del backend para dato dinámico (ver `docs/contratos-api/catalog-service.md`).
- La reidentificación (PB-009) se dispara manualmente desde la sidebar, no automáticamente al detectar una sesión perdida — falta que Customer Service defina el mecanismo real de detección (ver `docs/contratos-api/order-checkout-service.md`).
- `/ordenes/:id` hoy solo muestra lo que devuelve la creación de la orden — la vista consolidada completa (pago, despacho, entrega, incidencias) es PB-025, todavía no implementada.
- PB-014 AC3 pide que el cliente "reciba una notificación" al fallar definitivamente — hoy es solo un mensaje inline en `/ordenes/:id` y `/ordenes/:id/pago`; la notificación real (SMS/correo/in-app) depende de Notification Service y de PB-040, todavía no implementado.
