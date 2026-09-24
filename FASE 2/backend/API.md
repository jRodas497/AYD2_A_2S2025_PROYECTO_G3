# API — núcleo comercial (Backend 1)

Para el equipo de frontend. Cubre catálogo, clientes (con su historial), inventario (con sus movimientos), carrito/órdenes y atenciones.

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

---

## Historial del cliente

### `GET /api/customers/{id}/orders?limit=50`
Las órdenes del cliente, más recientes primero, con el mismo cuerpo que `GET /api/orders/{id}`. `404` si el cliente no existe.

### `GET /api/customers/{id}/history?limit=50`
La ficha que ve el agente: el cliente, sus órdenes y sus atenciones en una sola respuesta.

```json
{
  "customer": { "id": 15, "fullName": "Cliente de prueba 15", "...": "..." },
  "orders": [ { "orderId": 18782, "status": "PENDING_PAYMENT", "...": "..." } ],
  "incidents": [ { "id": 636, "orderId": 1402, "type": "RETURN", "status": "RESOLVED", "...": "..." } ]
}
```

---

## Atenciones (cambios y devoluciones)

| Campo | Valores |
|---|---|
| `type` | `EXCHANGE` (cambio), `RETURN` (devolución) |
| `status` | `REGISTERED`, `IN_PROCESS`, `RESOLVED`, `REJECTED` |

### `POST /api/orders/{id}/incidents`
Registra una atención sobre una orden. `201` con la atención creada.

```json
{ "type": "RETURN", "description": "Llegó con la caja dañada", "actor": "agente-07" }
```
`actor` es opcional (quién atiende; sin login se guarda tal cual llega). Solo se aceptan órdenes ya pagadas (`PAID` en adelante): antes de eso, `409`. Si `description` contiene algo que parece un número de tarjeta, `409` y no se guarda.

```json
{ "id": 811, "orderId": 20007, "type": "RETURN", "status": "REGISTERED", "description": "Llegó con la caja dañada", "createdAt": "2026-09-24T03:59:17Z", "resolvedAt": null }
```

### `PATCH /api/incidents/{id}`
Avanza la atención.

```json
{ "status": "RESOLVED", "note": "devolución aceptada", "actor": "agente-07" }
```
Una **devolución resuelta deja la orden en `RETURNED`**. Una atención `RESOLVED` o `REJECTED` ya no se puede cambiar (`409`). Al cerrarse, el cliente recibe un aviso.

### `GET /api/orders/{id}/incidents` · `GET /api/incidents/{id}`

Cada alta y cada cambio de estado queda en la auditoría (`ATENCION_REGISTRADA`, `ATENCION_IN_PROCESS`, `ATENCION_RESOLVED`, `ATENCION_REJECTED`) con quién lo hizo. El reembolso de una devolución no está en el MVP.
