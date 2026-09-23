# Backend — núcleo comercial

Java 21 + Spring Boot. Cubre la parte de Backend 1 del reparto: catálogo, clientes, inventario y órdenes/carrito. Pagos, facturación, logística, notificaciones e integraciones (ERP/POS) son parte del otro backend y no están aquí.

## Cómo levantarlo

Desde `FASE 2`, con la base ya definida en `docker-compose.yml`:

```
docker compose up -d --build backend
```

Levanta también `db` si no estaba corriendo (depende de que la base esté sana). Queda escuchando en `http://127.0.0.1:8080`.

Se conecta con el rol `sgologic_app`, nunca con `sgologic`. Ver `FASE 2/db/README.md` para las credenciales de desarrollo.

## Qué hace cada paquete

| Paquete | Responsabilidad |
|---|---|
| `catalog` | Productos (RF: catálogo) |
| `customers` | Clientes |
| `inventory` | Ubicaciones, reserva atómica de stock (RF04) y el job que libera reservas vencidas |
| `orders` | Carrito unificado (RF01), checkout y consulta de estado de orden (RC01) |
| `config` | Lectura de `config.setting` (por ejemplo el TTL de la reserva) |

Las tablas de referencia (canal, estado de orden, etc.) no tienen una entidad JPA por tabla: son enums de Java con el mismo id fijo que ya documenta `FASE 2/db/README.md`, convertidos con un `AttributeConverter`. Evita 17 tablas de referencia adicionales para algo que no cambia.

## La reserva de stock, en corto

`InventoryReservationService.reserve(...)` no decide el punto óptimo de despacho — esa decisión es de Logistics Service, después de facturar (CDU-04). Aquí solo se elige una ubicación con existencia (centros de distribución primero) y se reserva de forma atómica: un `UPDATE ... WHERE on_hand - reserved >= :cantidad` que solo afecta una fila si de verdad hay existencia. Si no la hay, se prueba la siguiente ubicación candidata; si ninguna alcanza, se lanza `InsufficientStockException` (409) y toda la orden se revierte — no queda una orden a medio reservar.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/products` | Catálogo activo |
| GET | `/api/products/{id}` | Un producto |
| GET | `/api/customers/{id}` | Un cliente |
| POST | `/api/customers` | Crear cliente |
| GET | `/api/inventory/products/{id}/availability` | Existencia consolidada por ubicación (RF03) |
| GET | `/api/customers/{id}/cart` | Ver el carrito activo (sin crear ni tocar el canal) |
| POST | `/api/customers/{id}/cart/items` | Agregar un ítem (crea el carrito si no existe) |
| POST | `/api/orders/checkout` | Convierte el carrito en orden, reserva stock |
| GET | `/api/orders/{id}` | Estado completo de la orden (RC01, `orders.order_overview`) |

## Lo que falta a propósito

No incluye gestión de incidencias (cambios/devoluciones), ni CRUD completo de catálogo (crear/editar producto). El enunciado prioriza el camino feliz de la demo; con el tiempo que quedó para la Fase 2, esto se dejó fuera a propósito, no por descuido.

El `createdAt` que devuelve el checkout en la respuesta sale `null`: la columna tiene su valor por `DEFAULT now()` en la base y Hibernate no lo relee después de insertar. La consulta de estado (`GET /api/orders/{id}`) sí trae el valor real, porque lee directo de la vista.
