# API — núcleo comercial (Backend 1)

Para el equipo de frontend. Cubre catálogo, clientes, inventario y carrito/órdenes.

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
`fullName` es obligatorio; `email`, si se manda, debe tener formato válido. `phone` y `address` son opcionales.

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
