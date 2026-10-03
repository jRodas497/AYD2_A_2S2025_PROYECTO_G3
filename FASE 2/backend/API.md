# API — núcleo comercial (Backend 1)

Para el equipo de frontend. Cubre sesión, catálogo, clientes (con su historial), inventario (con sus movimientos), carrito/órdenes e incidencias.

Pagos, facturación, logística, notificaciones, auditoría e integraciones (PayKlik, SAT, LogiExpress, POS, ERP) están documentados en [`API-Transacciones.md`](API-Transacciones.md).

Base local: `http://localhost:8080`. Todo responde JSON, entrada y salida.

En Postman: importa `postman/SGO-Logic-Backend.postman_collection.json` y el entorno `postman/SGO-Logic-Local.postman_environment.json`, selecciona ese entorno y ya queda apuntando a `{{baseUrl}}` = `http://localhost:8080`.

## Antes de nada: levantar el backend

```
cd FASE 2
docker compose up -d --build backend
```

Levanta la base si no estaba corriendo. La base ya trae 12 productos, 100 clientes y el inventario sembrados (`FASE 2/db/README.md`), así que se puede probar sin crear nada primero.

## Formato de error

Cualquier error (400, 404, 409) responde con la misma forma:

```json
{
  "timestamp": "2026-09-22T17:07:08.348909125Z",
  "status": 409,
  "error": "Conflict",
  "message": "no hay existencia suficiente del producto 1 para reservar 99999 unidad(es)",
  "path": "/api/orders/checkout"
}
```

Un error de validación (400) además trae `errors`, un arreglo con un objeto por campo inválido (`field`, `defaultMessage`, etc. — es el formato estándar de Spring).

## Iniciar sesión

Casi toda la API sigue abierta (carrito, checkout, catálogo de solo lectura, consultas). Piden sesión las acciones que las CDU marcan como de Administrador: crear o editar un producto, cambiar un parámetro y gestionar al personal (rol `ADMIN`), y procesar una incidencia (cualquier sesión).

### `POST /api/auth/login`
```json
{ "username": "admin", "password": "admin123" }
```
`200` con el token:
```json
{ "token": "eyJhbGciOiJIUzM4NCJ9...", "username": "admin", "roles": ["ADMIN"] }
```
Ese es el único usuario que trae la base sembrada (`FASE 2/db/migrations/V7__usuario_de_prueba.sql`). `401` si el usuario o la contraseña no coinciden. Después de 5 intentos fallidos seguidos, la cuenta queda bloqueada 15 minutos (`423`), aunque en el siguiente intento se mande la contraseña correcta.

Para usar el token, mandarlo en cada petición protegida:
```
Authorization: Bearer eyJhbGciOiJIUzM4NCJ9...
```
Dura 8 horas. No hay endpoint para renovarlo: cuando expira, se vuelve a hacer login.

`401` sin el header (o con un token vencido/inválido): `"hace falta iniciar sesión"`. `403` con un token válido pero sin el rol que pide el endpoint: `"el usuario no tiene permiso para esto"`.

## Valores fijos (enums)

Estos campos solo aceptan uno de estos textos, en mayúsculas, tal cual:

| Campo | Valores |
|---|---|
| `channel` | `WEB`, `MOBILE`, `CALL_CENTER` |
| `category` (en producto) | `LINEA_BLANCA`, `ELECTRONICA`, `ROPA`, `CALZADO` |
| `status` (carrito) | `OPEN`, `IN_CHECKOUT`, `CONVERTED`, `ABANDONED` |
| `status` (orden) | `PENDING_PAYMENT`, `PAYMENT_IN_PROGRESS`, `PAYMENT_FAILED`, `PAID`, `INVOICED`, `IN_DISPATCH`, `DELIVERED`, `CANCELLED`, `RETURNED` |

Toda orden nueva queda en `PENDING_PAYMENT`. `lastPaymentResult`, `invoiceStatus`, `shipmentStatus` y `trackingNumber` (en la consulta de una orden) vienen `null` hasta que se cobre: a partir del cobro, el resto del flujo —factura, despacho y guía— avanza solo y esos campos se van llenando. Ver [`API-Transacciones.md`](API-Transacciones.md).

---

## Catálogo

### `GET /api/products`
Lista los productos activos.

```json
[
  { "id": 1, "sku": "LB-003", "name": "Estufa de 4 quemadores", "category": "LINEA_BLANCA", "price": 2100.00, "active": true }
]
```

### `GET /api/products/{id}`
Un producto. `404` si no existe.

### `POST /api/products` — requiere sesión (rol `ADMIN`)
Configurar Catálogo de Productos: alta. Deja el producto con existencia en 0 en las 34 ubicaciones (no queda ausente del inventario).

```json
{ "sku": "EL-010", "name": "Parlante bluetooth", "category": "ELECTRONICA", "price": 350.00 }
```
`201` con el producto creado (`active` sale `true`). `409` si el `sku` ya existe. `400` si falta algún campo o `price` es negativo.

### `PUT /api/products/{id}` — requiere sesión (rol `ADMIN`)
Edita nombre, categoría, precio y si está activo.

```json
{ "name": "Parlante bluetooth XL", "category": "ELECTRONICA", "price": 420.00, "active": true }
```
`active` es opcional (si no se manda, no cambia). `200` con el producto actualizado, `404` si no existe.

---

## Clientes

### `GET /api/customers/{id}`
```json
{ "id": 1, "fullName": "Cliente de prueba 1", "email": "cliente1@example.com", "phone": "50200000001", "taxId": "CF", "address": "Zona 2, Ciudad de Guatemala", "createdAt": "2026-09-22T04:03:01Z" }
```
`404` si no existe.

### `POST /api/customers`
Crea un cliente. `201` con el cliente creado.

```json
{ "fullName": "Cliente de prueba", "email": "correo@example.com", "phone": "50200000000", "address": "Zona 1" }
```
`fullName` es obligatorio; `email`, si se manda, debe tener formato válido y no estar registrado ya (si lo está, `409`). `phone` y `address` son opcionales.

### `PUT /api/customers/{id}`
Modifica los datos de un cliente. Mismo cuerpo que crear, mismas reglas. `200` con el cliente actualizado, `404` si no existe.

---

## Inventario

### `GET /api/inventory/products/{id}/availability`
Existencia disponible (`on_hand - reserved`) de un producto, sumada y desglosada por ubicación.

```json
{
  "productId": 1,
  "totalAvailable": 920,
  "byLocation": [
    { "locationCode": "CD-01", "locationName": "Centro de distribución 1", "available": 199 },
    { "locationCode": "T-02", "locationName": "Tienda 02", "available": 22 }
  ]
}
```

No es la ubicación de despacho final — esa la decide el otro backend después de facturar. Esto es solo cuánto hay disponible ahora mismo.

### `POST /api/inventory/movements`
Registra una entrada (reposición, compra, devolución física) o una salida manual (merma, ajuste) en un centro o una tienda. `201` con el movimiento y la existencia resultante.

```json
{ "locationCode": "T-07", "productId": 3, "type": "IN", "quantity": 12, "reason": "Reposición desde proveedor" }
```
`type` es `IN` o `OUT`. Una salida solo puede sacar lo disponible (`on_hand - reserved`): nunca toca unidades ya reservadas para una orden; si no alcanza, `409`. Si la ubicación es una tienda, se le encola el evento a su POS. Queda en la auditoría.

```json
{ "id": 28605, "locationCode": "T-07", "productId": 3, "type": "IN", "quantity": 12, "reason": "Reposición desde proveedor", "orderId": null, "createdAt": "...", "onHandNow": 20, "reservedNow": 0 }
```

### `POST /api/inventory/adjustments`
Ajuste por conteo físico que reporta el POS de una tienda (o un conteo en un centro). El conteo se acepta como la existencia real: la diferencia contra lo registrado queda como movimiento de entrada o salida y en la auditoría (`INVENTARIO_AJUSTE`), y si es una tienda se avisa a su POS. `201`.

```json
{ "locationCode": "T-03", "productId": 4, "countedQuantity": 9, "source": "POS T-03 conteo semanal" }
```
```json
{ "locationCode": "T-03", "productId": 4, "registered": 7, "counted": 9, "difference": 2, "reserved": 0 }
```
`source` es opcional (por defecto, "POS" más el código de la ubicación). Un conteo menor a lo que ya está reservado para órdenes se rechaza con `409` —esas unidades están comprometidas con clientes— y el intento también queda auditado (`INVENTARIO_AJUSTE_RECHAZADO`).

### `GET /api/inventory/products/{id}/movements?limit=50`
Los últimos movimientos de un producto en todas las ubicaciones, incluidos los que generan el despacho y la reasignación (esos traen `orderId`).

---

## Carrito

Un cliente tiene un único carrito activo, sin importar desde qué canal compre. Agregar desde `MOBILE` después de haber agregado desde `WEB` no crea un carrito nuevo: actualiza el mismo.

### `GET /api/customers/{id}/cart`
Ver el carrito activo. No lo crea ni le cambia el canal — es de solo lectura. Si el cliente no tiene carrito activo, responde `200` con todo en `null`/vacío, no `404` (el `404` es solo si el cliente mismo no existe):

```json
{ "cartId": null, "status": null, "channel": null, "items": [] }
```

### `POST /api/customers/{id}/cart/items`
Agrega un producto (o le suma cantidad si ya estaba). Crea el carrito si no existía.

```json
{ "productId": 1, "quantity": 2, "channel": "WEB" }
```
`channel` es opcional (por defecto `WEB`). `quantity` debe ser 1 o más. Responde `200` con el carrito completo:

```json
{ "cartId": 1, "status": "OPEN", "channel": "WEB", "items": [{ "productId": 1, "quantity": 2 }] }
```
`404` si el cliente o el producto no existen (o el producto está inactivo).

### `PUT /api/customers/{id}/cart/items/{productId}`
Fija la cantidad exacta de un producto que ya está en el carrito.

```json
{ "quantity": 1, "channel": "MOBILE" }
```
`quantity` debe ser 1 o más (para quitarlo, usar `DELETE`). `channel` es opcional y, si viene, queda como el último canal desde el que se tocó el carrito. Responde el carrito completo. `404` si el cliente no tiene carrito activo o el producto no está en él.

### `POST /api/customers/{id}/cart/items/{productId}/decrement?channel=WEB`
Baja una unidad del producto en una sola sentencia en la base, sin enviar la cantidad: dos bajadas concurrentes desde el mismo carrito suman dos. Si solo quedaba una unidad, el producto sale del carrito. Responde el carrito completo. `404` si el producto no está en el carrito.

### `DELETE /api/customers/{id}/cart/items/{productId}?channel=WEB`
Quita un producto del carrito. `channel` es opcional. Responde el carrito completo (que puede quedar vacío). `404` en los mismos casos que el anterior.

El carrito no reserva stock —la reserva ocurre al hacer checkout—, así que cambiar o quitar productos no mueve el inventario.

---

## Órdenes

### `POST /api/orders/checkout`
Convierte el carrito activo del cliente en una orden: reserva stock producto por producto (centros de distribución primero) y crea la orden en `PENDING_PAYMENT`. Si algún producto no tiene existencia suficiente, nada se guarda — ni la orden ni las reservas parciales.

```json
{ "customerId": 1, "deliveryAddress": "Zona 10, Ciudad de Guatemala" }
```

`201` con la orden creada:
```json
{ "id": 1, "cartId": 1, "customerId": 1, "channel": "WEB", "status": "PENDING_PAYMENT", "total": 4500.00, "deliveryAddress": "Zona 10, Ciudad de Guatemala", "createdAt": null, "updatedAt": "2026-09-22T04:05:48Z" }
```
`createdAt` sale `null` en esta respuesta puntual (limitación conocida, ver `README.md` del backend); para tenerlo, pedir el detalle con el siguiente endpoint.

`400` si el cliente no tiene carrito activo o está vacío. `409` si algún producto ya no está activo o no alcanza el stock.

### `GET /api/orders/{id}`
Estado completo de la orden en una sola consulta — pensado para responder rápido incluso con muchas órdenes.

```json
{
  "orderId": 1,
  "createdAt": "2026-09-22T04:05:48Z",
  "customerId": 1,
  "customer": "Cliente de prueba 1",
  "channel": "WEB",
  "status": "PENDING_PAYMENT",
  "total": 4500.00,
  "lastPaymentResult": null,
  "paymentAttempts": null,
  "invoiceStatus": null,
  "shipmentStatus": null,
  "trackingNumber": null
}
```
`404` si la orden no existe.

### `POST /api/orders/{orderId}/incidents`
Registra un cambio o una devolución sobre una orden (Gestión de Incidencias).

```json
{ "type": "RETURN", "description": "El cliente reporta que llegó dañado" }
```
`type` es `EXCHANGE` o `RETURN`. `201` con la incidencia, en estado `REGISTERED`. `404` si la orden no existe. Si `description` contiene algo que parece un número de tarjeta, `409` y no se guarda.

```json
{ "id": 811, "orderId": 20007, "type": "RETURN", "status": "REGISTERED", "description": "El cliente reporta que llegó dañado", "createdAt": "2026-09-24T03:59:17Z", "resolvedAt": null }
```

### `GET /api/orders/{orderId}/incidents`
Lista las incidencias de una orden.

### `GET /api/incidents/{id}`
Una incidencia. `404` si no existe.

### `PUT /api/incidents/{id}/status` — requiere sesión (cualquier usuario logueado)
Procesa la incidencia: la mueve a `IN_PROCESS`, `RESOLVED` o `REJECTED`. Al pasarla a `RESOLVED` o `REJECTED` se guarda `resolvedAt`.

```json
{ "status": "IN_PROCESS" }
```
`404` si la incidencia no existe. Una incidencia `RESOLVED` o `REJECTED` ya no se puede cambiar (`409`), y ninguna vuelve a `REGISTERED` (`400`). Una **devolución resuelta deja la orden en `RETURNED`** si ya estaba cobrada. Al cerrarse, el cliente recibe un aviso.

Cada alta y cada cambio de estado queda en la auditoría (`INCIDENCIA_REGISTRADA`, `INCIDENCIA_IN_PROCESS`, `INCIDENCIA_RESOLVED`, `INCIDENCIA_REJECTED`) con quién lo hizo: el usuario del token, o `atencion-al-cliente` si se registró sin sesión. El reembolso de una devolución no está en el MVP.

---

## Historial del cliente

### `GET /api/customers/{id}/orders?limit=50`
Las órdenes del cliente, más recientes primero, con el mismo cuerpo que `GET /api/orders/{id}`. `404` si el cliente no existe.

### `GET /api/customers/{id}/history?limit=50`
La ficha que ve el agente: el cliente, sus órdenes y sus incidencias en una sola respuesta.

```json
{
  "customer": { "id": 15, "fullName": "Cliente de prueba 15", "...": "..." },
  "orders": [ { "orderId": 18782, "status": "PENDING_PAYMENT", "...": "..." } ],
  "incidents": [ { "id": 636, "orderId": 1402, "type": "RETURN", "status": "RESOLVED", "...": "..." } ]
}
```

---

## Backoffice: listados y administración

Consultas que usan las pantallas del personal. Todas aceptan `limit` (por defecto 50) y devuelven los registros más recientes primero. Un filtro con un valor que no existe devuelve una lista vacía.

### `GET /api/orders?status=&customerId=&channel=&q=&limit=50`
Listado y búsqueda de órdenes. `status` y `channel` usan los códigos de la sección de valores fijos; `q` busca por nombre del cliente o número de orden.

```json
[{ "orderId": 149, "createdAt": "2026-09-26T17:37:00.931523Z", "customerId": 106, "customer": "Cliente invitado",
   "channel": "WEB", "status": "PAYMENT_FAILED", "total": 7000.0, "lastPaymentResult": "TIMEOUT", "paymentAttempts": 6,
   "invoiceStatus": null, "shipmentStatus": null, "trackingNumber": null }]
```

### `GET /api/customers?q=&limit=50`
Búsqueda de clientes por nombre, correo o teléfono. Devuelve el mismo cuerpo que `GET /api/customers/{id}`.

### `GET /api/incidents?status=&type=&limit=50`
Bandeja de incidencias de todas las órdenes, con el cliente y el total de la orden.

```json
[{ "id": 1, "orderId": 85, "customerId": 47, "customer": "Cliente de prueba 47", "type": "RETURN", "status": "RESOLVED",
   "description": "producto dañado", "orderTotal": 390.0, "createdAt": "2026-09-26T04:46:29.167752Z", "resolvedAt": "2026-09-26T04:46:29.22079Z" }]
```

### `GET /api/inventory/reservations?status=&productId=&limit=50`
Reservas de stock con el producto y la ubicación. `status`: `ACTIVE`, `CONFIRMED`, `RELEASED`, `EXPIRED`.

```json
[{ "id": 84, "orderId": 149, "productId": 2, "sku": "LB-002", "productName": "Lavadora 18 kg", "locationCode": "CD-01",
   "quantity": 2, "status": "EXPIRED", "createdAt": "2026-09-26T17:37:00.931523Z", "expiresAt": "2026-09-26T17:57:00.940916Z",
   "closedAt": "2026-09-26T18:43:20.920534Z" }]
```

### `GET /api/settings`
Los parámetros de negocio: `reservation.ttl_minutes`, `payment.timeout_ms` y `erp.batch_interval_minutes`, cada uno con `key`, `value` y `description`.

### `PUT /api/settings/{key}` — requiere sesión (rol `ADMIN`)
```json
{ "value": "30" }
```
El cambio aplica sin reiniciar el backend.

### `GET /api/users` — requiere sesión (rol `ADMIN`)
El personal con acceso al sistema. Nunca incluye la contraseña.

```json
[{ "id": 1, "username": "admin", "fullName": "Administrador de prueba", "email": "admin@example.com", "active": true,
   "storeId": null, "roles": ["ADMIN"], "lastLoginAt": "2026-10-01T04:42:21.244805Z" }]
```

### `POST /api/users` — requiere sesión (rol `ADMIN`)
```json
{ "username": "logistica1", "fullName": "Encargado de logística", "email": "logistica@example.com",
  "password": "una-clave", "storeId": null, "roles": ["LOGISTICS"] }
```
Roles: `ADMIN`, `STORE_EMPLOYEE`, `STORE_MANAGER`, `CALL_CENTER_AGENT`, `LOGISTICS`, `FINANCE`. `storeId` es opcional y apunta a una tienda.

### `PUT /api/users/{id}/roles` — requiere sesión (rol `ADMIN`)
```json
{ "roles": ["LOGISTICS", "STORE_EMPLOYEE"] }
```

### `PUT /api/users/{id}/active` — requiere sesión (rol `ADMIN`)
```json
{ "active": false }
```
Un usuario no se borra: se desactiva y deja de poder iniciar sesión.
